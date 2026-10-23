import { TypingEngine } from '../lib/typing/engine';
import { evaluateLesson } from '../lib/lesson-rules';
import type { LessonAttempt, LessonOutcome, LessonRule } from '../lib/lesson-rules';
import { guidanceFor } from '../lib/typing/guidance';
import { playKeystroke, primeKeySound } from './key-sound';
import {
	clearLessonDraft,
	markLessonSkipped,
	markLessonStarted,
	readLessonDraft,
	readLessonRecord,
	recordLessonAttempt,
	writeLessonDraft,
} from '../lib/lesson-progress';
import type { LessonRecord } from '../lib/lesson-progress';

/**
 * The lesson player.
 *
 * One instance per `[data-lesson-studio]`. The engine owns time and scoring;
 * this file owns the DOM, the clipboard-free input surface and the small
 * amount of progress persisted between visits.
 *
 * Design notes
 * ------------
 * - Physical keyboards are handled on `keydown` so the browser's own editing
 *   is never in the way. Mobile keyboards do not always report a usable
 *   `key`, so a transparent `input` event fallback picks those characters up.
 * - The clock only renders when the displayed second changes. Keystrokes force
 *   a render so accuracy and errors feel immediate.
 * - The draft is written on a short throttle and again on pause and page hide.
 *   A reload restores the text, the time and the raw keystroke counters, then
 *   starts paused so the visitor is not charged for the time it took to read
 *   the "resumed" note.
 */

const UNTIMED = Number.POSITIVE_INFINITY;
const DRAFT_DELAY_MS = 700;

function text(el: Element | null, value: string): void {
	if (el && el.textContent !== value) el.textContent = value;
}

function formatClock(ms: number, direction: 'up' | 'down'): string {
	const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
	const seconds = direction === 'down' ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatPercent(value: number): string {
	if (!Number.isFinite(value)) return '—';
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function capitalise(value: string): string {
	return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

class LessonPlayer {
	readonly #root: HTMLElement;
	readonly #lessonId: string;
	readonly #target: string;
	readonly #timedSeconds: number | null;
	readonly #rule: LessonRule;
	readonly #engine: TypingEngine;

	readonly #chars: HTMLElement[];
	readonly #scroll: HTMLElement;
	readonly #input: HTMLTextAreaElement;
	readonly #overlay: HTMLElement;
	readonly #overlayButton: HTMLButtonElement | null;
	readonly #result: HTMLElement;
	readonly #progressFill: HTMLElement | null;
	readonly #meter: HTMLElement | null;
	readonly #nextHref: string;
	readonly #exitButton: HTMLButtonElement | null;

	readonly #keyEls = new Map<string, HTMLElement>();
	readonly #nextButtons: HTMLButtonElement[] = [];
	readonly #pauseButtons: HTMLButtonElement[] = [];
	readonly #pauseLabels: HTMLElement[] = [];

	#finished = false;
	#started = false;
	#nextUnlocked = false;
	#rafId = 0;
	#renderedSecond = -1;
	#renderedCursor = -1;
	#saveTimer: number | null = null;
	#pressedKeyEl: HTMLElement | null = null;
	#nextKeyEl: HTMLElement | null = null;
	#shiftKeyEl: HTMLElement | null = null;
	#outcome: LessonOutcome | null = null;
	#record: LessonRecord | null = null;
	readonly #staticSpeedNote: string;
	#usingFallback = false;
	#inerted: HTMLElement[] = [];

	constructor(root: HTMLElement) {
		this.#root = root;

		const lessonId = root.dataset.lessonId ?? '';
		const target = root.dataset.lessonText ?? '';
		if (!lessonId || !target) {
			throw new Error('lesson studio: missing lesson id or text');
		}

		const rawSeconds = root.dataset.lessonSeconds ?? '';
		const seconds = rawSeconds ? Number(rawSeconds) : NaN;
		const timedSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : null;

		this.#lessonId = lessonId;
		this.#target = target;
		this.#timedSeconds = timedSeconds;
		this.#rule = {
			text: target,
			timedSeconds,
			minAccuracy: Number(root.dataset.lessonMinAccuracy) || 90,
			minCharacters: Number(root.dataset.lessonMinCharacters) || 0,
		};
		this.#nextHref = root.dataset.lessonNextHref ?? '';
		this.#engine = new TypingEngine(target, timedSeconds ? timedSeconds * 1000 : UNTIMED);
		this.#staticSpeedNote =
			timedSeconds === null
				? 'Speed is measured when you finish the passage.'
				: 'Net WPM, live, with errors removed.';

		this.#chars = [...root.querySelectorAll<HTMLElement>('[data-lesson-char]')];
		this.#scroll = this.#must<HTMLElement>('[data-lesson-scroll]');
		this.#input = this.#must<HTMLTextAreaElement>('[data-lesson-input]');
		this.#overlay = this.#must<HTMLElement>('[data-lesson-overlay]');
		this.#overlayButton = this.#overlay.querySelector<HTMLButtonElement>('[data-lesson-pause]');
		this.#result = this.#must<HTMLElement>('[data-lesson-result]');
		this.#progressFill = root.querySelector<HTMLElement>('[data-lesson-meter-fill]');
		this.#meter = root.querySelector<HTMLElement>('[data-lesson-meter]');
		this.#exitButton = root.querySelector<HTMLButtonElement>('[data-lesson-exit]');

		for (const element of root.querySelectorAll<HTMLElement>('[data-vk-key]')) {
			const id = element.dataset.vkKey;
			if (id) this.#keyEls.set(id, element);
		}
		for (const button of root.querySelectorAll<HTMLButtonElement>('[data-lesson-next]')) {
			this.#nextButtons.push(button);
		}
		for (const button of root.querySelectorAll<HTMLButtonElement>('[data-lesson-pause]')) {
			this.#pauseButtons.push(button);
		}
		for (const label of root.querySelectorAll<HTMLElement>('[data-lesson-pause-label]')) {
			this.#pauseLabels.push(label);
		}

		this.#bind();
		this.#record = readLessonRecord(lessonId);
		this.#nextUnlocked =
			this.#record?.status === 'completed' || this.#record?.status === 'skipped';
		this.#applyRecordState();
		this.#paintAll();
		this.#renderStats(true);
		this.#renderControls();

		if (this.#restoreDraft()) {
			// Start frozen. The visitor resumes when they are actually ready.
			this.#engine.pause(this.#now());
			this.#renderControls();
			this.#renderStats(true);
		}
	}

	#must<T extends Element>(selector: string): T {
		const element = this.#root.querySelector<T>(selector);
		if (!element) throw new Error(`lesson studio: missing ${selector}`);
		return element;
	}

	#now(): number {
		return performance.now();
	}

	#bind(): void {
		this.#input.addEventListener('keydown', this.#onKeyDown);
		this.#input.addEventListener('input', this.#onInput);
		this.#input.addEventListener('paste', this.#onPaste);
		this.#input.addEventListener('drop', this.#onPaste);

		// Browsers refuse to decode audio until the visitor has interacted with
		// the page, so the sample is warmed on the first real interaction.
		for (const type of ['pointerdown', 'keydown', 'touchstart'] as const) {
			window.addEventListener(type, () => primeKeySound(), { once: true, passive: true });
		}

		this.#root.addEventListener('pointerdown', (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest('button, a')) return;
			// Clicking the drill is the start gesture. Take the screen with it,
			// before the first keystroke, when the lesson has not begun yet.
			if (this.#engine.state === 'idle') this.#enterFocusMode();
			this.#input.focus();
		});

		for (const button of this.#pauseButtons) {
			button.addEventListener('click', () => this.#togglePause(false));
		}
		for (const button of this.#root.querySelectorAll<HTMLButtonElement>('[data-lesson-restart]')) {
			button.addEventListener('click', () => this.#restart());
		}
		for (const button of this.#nextButtons) {
			button.addEventListener('click', () => this.#goNext());
		}
		const skip = this.#root.querySelector<HTMLButtonElement>('[data-lesson-skip]');
		skip?.addEventListener('click', () => this.#skip());

		this.#exitButton?.addEventListener('click', () => this.#exitFocusMode());
		document.addEventListener('fullscreenchange', () => this.#updateFocusState());

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden' && this.#engine.state === 'running') {
				this.#togglePause(false);
			}
		});
		window.addEventListener('pagehide', () => this.#saveDraft(true));
	}

	/* --- input ------------------------------------------------------------ */

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.isComposing) return;
		if (event.key === 'Tab') return; // never trap keyboard navigation
		if (event.key === 'Escape') {
			event.preventDefault();
			// In focus mode Escape leaves the screen first; the next press
			// pauses the lesson. Without native fullscreen the same key has to
			// dismiss our own layer by hand.
			if (this.#isFocusActive()) {
				this.#exitFocusMode();
				return;
			}
			this.#togglePause(true);
			return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey) return;

		if (this.#finished || this.#engine.isPaused) {
			event.preventDefault();
			return;
		}
		if (event.key === 'Backspace') {
			event.preventDefault();
			this.#backspace();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			return;
		}
		if (event.key.length !== 1) return;

		event.preventDefault();
		this.#type(event.key);
	};

	#onInput = (event: Event): void => {
		const value = this.#input.value;
		if (!value) return;
		this.#input.value = '';
		if (event instanceof InputEvent && event.isComposing) return;
		if (this.#finished || this.#engine.isPaused) return;

		for (const char of [...value]) {
			if (char === '\n' || char === '\r') continue;
			this.#type(char);
			if (this.#finished) break;
		}
	};

	#onPaste = (event: Event): void => {
		event.preventDefault();
	};

	#type(char: string): void {
		if (this.#finished || this.#engine.isPaused) return;

		const now = this.#now();
		const expected = this.#target[this.#engine.cursor];
		const index = this.#engine.type(char, now);
		if (index < 0) return;

		const correct = char === expected;

		// Audio is the physical feedback of the key press, so it fires for
		// wrong keys too — with the mistake's own sample. It follows the same
		// clock as the engine and the burst detection.
		playKeystroke(char, correct, now);

		this.#paintChar(index);
		this.#markKeyboard(char, correct);
		this.#paintGuidance();
		this.#paintCursor();
		this.#keepCaretVisible();
		this.#renderStats(true);
		this.#renderControls();
		this.#scheduleSave();

		if (!this.#started) {
			// The first accepted keystroke is the start of the drill. Take over
			// the screen from here, inside the keydown so the browser still
			// counts it as player activation.
			this.#enterFocusMode();
			this.#started = true;
			markLessonStarted(this.#lessonId);
			this.#record = readLessonRecord(this.#lessonId);
			this.#renderBest();
			if (!this.#finished) this.#setStatus('In progress', 'active');
		}

		this.#startLoop();

		if (this.#engine.typed.length >= this.#target.length) this.#end(false);
	}

	#backspace(): void {
		if (this.#finished || this.#engine.isPaused) return;
		const removed = this.#engine.backspace();
		if (removed < 0) return;

		this.#paintChar(removed);
		this.#clearPressedKey();
		this.#paintGuidance();
		this.#paintCursor();
		this.#keepCaretVisible();
		this.#renderStats(true);
		this.#scheduleSave();
	}

	/* --- the clock -------------------------------------------------------- */

	#startLoop(): void {
		if (this.#rafId !== 0) return;
		if (this.#finished || this.#engine.state !== 'running') return;
		this.#rafId = requestAnimationFrame(this.#frame);
	}

	#stopLoop(): void {
		if (this.#rafId !== 0) cancelAnimationFrame(this.#rafId);
		this.#rafId = 0;
	}

	#frame = (timestamp: number): void => {
		this.#rafId = 0;
		if (this.#finished || this.#engine.state !== 'running') return;

		if (this.#engine.tick(timestamp)) {
			this.#end(true);
			return;
		}
		if (Math.floor(this.#engine.elapsedMs / 1000) !== this.#renderedSecond) {
			this.#renderStats();
		}
		this.#rafId = requestAnimationFrame(this.#frame);
	};

	#togglePause(moveFocus: boolean): void {
		if (this.#finished) return;

		if (this.#engine.state === 'running') {
			this.#engine.pause(this.#now());
			this.#stopLoop();
			this.#saveDraft(true);
			this.#renderControls();
			this.#renderStats(true);
			if (moveFocus) this.#overlayButton?.focus();
			return;
		}

		if (this.#engine.isPaused) {
			this.#engine.resume(this.#now());
			this.#renderControls();
			this.#renderStats(true);
			this.#startLoop();
			// Resuming is another start gesture, so the drill takes the screen
			// again. This also covers a draft restored from the last visit.
			this.#enterFocusMode();
			this.#input.focus();
		}
	}

	/* --- focus mode ------------------------------------------------------- */

	/** Whether the studio is currently filling the screen. */
	#isFocusActive(): boolean {
		return this.#usingFallback || document.fullscreenElement === this.#root;
	}

	/**
	 * Put the lesson on the whole screen.
	 *
	 * This runs from the click or keystroke that starts the drill, which is
	 * what the browser accepts as user activation. If native fullscreen is
	 * refused (iPhone Safari, an embedded frame, a permission policy) the
	 * fixed-layer fallback takes over so the result is the same.
	 */
	#enterFocusMode(): void {
		if (this.#isFocusActive()) return;

		if (this.#root.requestFullscreen) {
			try {
				const request = this.#root.requestFullscreen();
				void request?.catch(() => this.#activateFallback());
				return;
			} catch {
				this.#activateFallback();
				return;
			}
		}

		this.#activateFallback();
	}

	#activateFallback(): void {
		this.#usingFallback = true;
		// Without native fullscreen the page behind the fixed layer can still
		// scroll, leaving a scrollbar peeking out on the right. Lock it.
		document.documentElement.classList.add('ls-fallback');
		this.#updateFocusState();
	}

	/** Leave the screen without touching the drill in progress. */
	#exitFocusMode(): void {
		if (document.fullscreenElement) {
			const exit = document.exitFullscreen();
			void exit?.then(() => this.#input.focus({ preventScroll: true }));
			return;
		}

		if (this.#usingFallback) {
			this.#usingFallback = false;
			document.documentElement.classList.remove('ls-fallback');
			this.#updateFocusState();
			this.#input.focus({ preventScroll: true });
		}
	}

	#updateFocusState(): void {
		const active = this.#isFocusActive();
		const wasActive = this.#root.dataset.focus === 'true';
		this.#root.dataset.focus = active ? 'true' : 'false';
		// The page behind the layer is covered on screen; take it out of the
		// tab order and the accessibility tree too.
		this.#setPageInert(active);

		// Entering full screen can move focus to the browser's own container.
		// Put it back on the drill so the next keystroke lands where expected.
		if (active && !wasActive) this.#input.focus({ preventScroll: true });
	}

	#setPageInert(active: boolean): void {
		if (!active) {
			for (const element of this.#inerted) element.inert = false;
			this.#inerted = [];
			return;
		}

		if (this.#inerted.length > 0) return;

		let node: Element | null = this.#root;
		while (node && node !== document.body) {
			const parent: Element | null = node.parentElement;
			if (!parent) break;
			for (const sibling of Array.from(parent.children)) {
				if (sibling === node || sibling.hasAttribute('inert')) continue;
				const element = sibling as HTMLElement;
				element.inert = true;
				this.#inerted.push(element);
			}
			node = parent;
		}
	}

	/* --- finishing -------------------------------------------------------- */

	#end(endedByTime: boolean): void {
		if (this.#finished) return;
		this.#finished = true;

		this.#engine.finish(this.#now());
		this.#stopLoop();
		this.#cancelSave();
		clearLessonDraft(this.#lessonId);
		this.#input.readOnly = true;

		const stats = this.#engine.getStats();
		const attempt: LessonAttempt = {
			characters: stats.characters,
			errors: stats.errors,
			accuracy: stats.charAccuracy,
			endedByTime,
		};
		const outcome = evaluateLesson(this.#rule, attempt);
		this.#outcome = outcome;

		const record = recordLessonAttempt(this.#lessonId, {
			passed: outcome === 'passed',
			accuracy: stats.charAccuracy,
			wpm: stats.netWpm,
		});
		this.#record = record;

		if (outcome === 'passed') {
			this.#nextUnlocked = true;
		}
		this.#setNextEnabled(this.#nextUnlocked);
		this.#applyRecordState();
		this.#renderResult(outcome, stats.characters, stats.charAccuracy, stats.netWpm, stats.elapsedMs);
		this.#renderStats(true);
		this.#renderControls();
		this.#paintGuidance();
	}

	#renderResult(
		outcome: LessonOutcome,
		characters: number,
		accuracy: number,
		wpm: number,
		elapsedMs: number,
	): void {
		const eyebrow = this.#must<HTMLElement>('[data-lesson-result-eyebrow]');
		const title = this.#must<HTMLElement>('[data-lesson-result-title]');
		const detail = this.#must<HTMLElement>('[data-lesson-result-detail]');

		const bits = [`${formatPercent(accuracy)} accuracy`];
		bits.push(`${characters} of ${this.#target.length} characters`);
		if (this.#timedSeconds === null) bits.push(formatClock(elapsedMs, 'up'));
		if (wpm > 0) bits.push(`${Math.round(wpm)} WPM`);

		this.#result.hidden = false;

		if (outcome === 'passed') {
			this.#result.dataset.tone = 'pass';
			text(eyebrow, 'Lesson passed');
			text(
				title,
				this.#nextHref ? 'Nice work — the next lesson is unlocked.' : 'Curriculum complete.',
			);
			text(detail, bits.join(' · '));
			return;
		}

		this.#result.dataset.tone = 'fail';

		if (outcome === 'accuracy') {
			text(eyebrow, 'Not passed yet');
			text(
				title,
				`${formatPercent(accuracy)} accuracy — the target is ${formatPercent(this.#rule.minAccuracy)}.`,
			);
			text(detail, `${bits.join(' · ')}. Slow down for one more run; accuracy unlocks the next lesson.`);
			return;
		}

		if (outcome === 'too-short') {
			text(eyebrow, 'Not passed yet');
			text(
				title,
				`${characters} characters in ${this.#timedSeconds ?? 0} seconds — ${this.#rule.minCharacters} needed.`,
			);
			text(detail, `${bits.join(' · ')}. Try again when you are ready; the clock waits for your first key.`);
			return;
		}

		text(eyebrow, 'Not passed yet');
		text(title, 'The passage is not finished.');
		text(detail, 'Type the whole passage to complete this lesson.');
	}

	#skip(): void {
		if (this.#finished) return;

		markLessonSkipped(this.#lessonId);
		clearLessonDraft(this.#lessonId);
		this.#cancelSave();
		this.#record = readLessonRecord(this.#lessonId);
		this.#nextUnlocked = true;
		this.#setNextEnabled(true);
		this.#setStatus('Skipped', 'skipped');
		this.#renderBest();

		const skip = this.#root.querySelector<HTMLButtonElement>('[data-lesson-skip]');
		if (skip) {
			skip.disabled = true;
			skip.textContent = 'Lesson skipped';
		}
	}

	#goNext(): void {
		if (!this.#nextUnlocked || !this.#nextHref) return;
		this.#saveDraft(true);
		window.location.href = this.#nextHref;
	}

	#restart(): void {
		this.#cancelSave();
		clearLessonDraft(this.#lessonId);

		this.#engine.reset();
		this.#finished = false;
		this.#started = false;
		this.#outcome = null;
		this.#renderedSecond = -1;
		this.#renderedCursor = -1;

		this.#input.readOnly = false;
		this.#input.value = '';
		this.#result.hidden = true;
		this.#overlay.hidden = true;
		this.#root.querySelector<HTMLElement>('[data-lesson-resumed]')?.setAttribute('hidden', '');

		this.#clearPressedKey();
		this.#paintAll();
		this.#renderStats(true);
		this.#renderControls();
		this.#applyRecordState();
		this.#input.focus();
	}

	/* --- draft ------------------------------------------------------------ */

	#scheduleSave(): void {
		if (this.#finished || this.#saveTimer !== null) return;
		this.#saveTimer = window.setTimeout(() => {
			this.#saveTimer = null;
			this.#saveDraft();
		}, DRAFT_DELAY_MS);
	}

	#cancelSave(): void {
		if (this.#saveTimer !== null) {
			window.clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
	}

	#saveDraft(immediate = false): void {
		if (this.#finished) return;
		if (this.#engine.typed.length === 0) return;
		if (immediate) this.#cancelSave();

		const stats = this.#engine.getStats();
		writeLessonDraft({
			lessonId: this.#lessonId,
			typed: this.#engine.typed,
			elapsedMs: this.#engine.elapsedMs,
			keystrokes: stats.keystrokes,
			correctKeystrokes: stats.correctKeystrokes,
			savedAt: Date.now(),
		});
	}

	#restoreDraft(): boolean {
		const draft = readLessonDraft(this.#lessonId);
		if (!draft) return false;

		const duration = this.#timedSeconds === null ? UNTIMED : this.#timedSeconds * 1000;
		const usable =
			draft.typed.length > 0 &&
			draft.typed.length < this.#target.length &&
			draft.elapsedMs < duration;

		if (!usable) {
			clearLessonDraft(this.#lessonId);
			return false;
		}

		this.#engine.restore(
			draft.typed,
			draft.elapsedMs,
			draft.keystrokes,
			draft.correctKeystrokes,
			this.#now(),
		);
		this.#started = true;
		this.#record = readLessonRecord(this.#lessonId);
		this.#paintAll();
		this.#renderStats(true);
		this.#renderControls();
		const note = this.#root.querySelector<HTMLElement>('[data-lesson-resumed]');
		if (note) note.hidden = false;
		return true;
	}

	/* --- rendering -------------------------------------------------------- */

	#paintChar(index: number): void {
		const element = this.#chars[index];
		if (!element) return;

		const typed = this.#engine.typed;
		const state =
			index >= typed.length ? 'pending' : typed[index] === this.#target[index] ? 'correct' : 'incorrect';

		element.classList.toggle('is-correct', state === 'correct');
		element.classList.toggle('is-incorrect', state === 'incorrect');
	}

	#paintAll(): void {
		for (let index = 0; index < this.#chars.length; index += 1) this.#paintChar(index);
		this.#renderedCursor = -1;
		this.#paintCursor();
		this.#paintGuidance();
	}

	#paintCursor(): void {
		if (this.#renderedCursor >= 0) {
			this.#chars[this.#renderedCursor]?.classList.remove('is-current');
		}
		const cursor = this.#engine.cursor;
		this.#chars[cursor]?.classList.add('is-current');
		this.#renderedCursor = cursor;
	}

	#keepCaretVisible(): void {
		const cursor = this.#engine.cursor;
		const element = this.#chars[Math.min(cursor, this.#chars.length - 1)];
		if (!element) return;

		const top = element.offsetTop;
		const bottom = top + element.offsetHeight;
		const viewTop = this.#scroll.scrollTop;
		const viewBottom = viewTop + this.#scroll.clientHeight;

		if (top < viewTop + 8) {
			this.#scroll.scrollTop = Math.max(0, top - 8);
		} else if (bottom > viewBottom - 8) {
			this.#scroll.scrollTop = bottom - this.#scroll.clientHeight + 8;
		}
	}

	#markKeyboard(char: string, correct: boolean): void {
		this.#clearPressedKey();
		const guidance = guidanceFor(char);
		const element = this.#keyEls.get(guidance.keyId);
		if (!element) return;
		element.classList.add(correct ? 'is-correct' : 'is-incorrect');
		this.#pressedKeyEl = element;
	}

	#clearPressedKey(): void {
		this.#pressedKeyEl?.classList.remove('is-correct', 'is-incorrect');
		this.#pressedKeyEl = null;
	}

	#paintGuidance(): void {
		this.#nextKeyEl?.classList.remove('is-next');
		this.#nextKeyEl = null;
		this.#shiftKeyEl?.classList.remove('is-shift-hint');
		this.#shiftKeyEl = null;
		for (const element of this.#root.querySelectorAll<HTMLElement>('.hg-finger')) {
			element.classList.remove('is-active', 'is-shift');
		}

		const cap = this.#root.querySelector<HTMLElement>('[data-lesson-next-label]');
		const finger = this.#root.querySelector<HTMLElement>('[data-lesson-finger]');
		const shift = this.#root.querySelector<HTMLElement>('[data-lesson-shift]');
		const handTitle = this.#root.querySelector<HTMLElement>('[data-lesson-hand-title]');

		if (shift) shift.hidden = true;

		if (this.#finished) {
			if (cap) {
				cap.textContent = '✓';
				cap.dataset.wide = 'true';
			}
			text(finger, 'Lesson complete');
			text(handTitle, 'Done');
			return;
		}

		const char = this.#target[this.#engine.cursor];
		if (char === undefined) {
			if (cap) {
				cap.textContent = '✓';
				cap.dataset.wide = 'true';
			}
			text(finger, 'Lesson complete');
			text(handTitle, 'Done');
			return;
		}

		const guidance = guidanceFor(char);
		const display = char === ' ' ? 'space' : char.toUpperCase();

		if (cap) {
			cap.textContent = display;
			cap.dataset.wide = display.length > 2 ? 'true' : 'false';
		}
		text(finger, guidance.fingerLabel ? capitalise(guidance.fingerLabel) : 'Not on this keyboard');
		text(handTitle, guidance.fingerLabel ? capitalise(guidance.fingerLabel) : 'Keyboard');

		if (guidance.keyId) {
			const key = this.#keyEls.get(guidance.keyId);
			if (key) {
				key.classList.add('is-next');
				this.#nextKeyEl = key;
			}
		}

		if (guidance.shift && guidance.shiftHand) {
			const shiftId = guidance.shiftHand === 'left' ? 'ShiftLeft' : 'ShiftRight';
			const key = this.#keyEls.get(shiftId);
			if (key) {
				key.classList.add('is-shift-hint');
				this.#shiftKeyEl = key;
			}
			if (shift) {
				shift.hidden = false;
				shift.textContent = `Hold Shift with your ${guidance.shiftHand} little finger.`;
			}
		}

		const fingers =
			guidance.finger === 'thumb'
				? [...this.#root.querySelectorAll<HTMLElement>('.hg-finger[data-hg-finger="thumb"]')]
				: [...this.#root.querySelectorAll<HTMLElement>('.hg-finger')].filter(
						(element) =>
							element.dataset.hgHand === guidance.hand &&
							element.dataset.hgFinger === guidance.finger,
					);
		for (const element of fingers) element.classList.add('is-active');

		if (guidance.shiftHand) {
			for (const element of this.#root.querySelectorAll<HTMLElement>(
				`.hg-finger[data-hg-hand="${guidance.shiftHand}"][data-hg-finger="pinky"]`,
			)) {
				element.classList.add('is-shift');
			}
		}
	}

	#renderStats(force = false): void {
		const elapsed = this.#engine.elapsedMs;
		const second = Math.floor(elapsed / 1000);
		if (!force && second === this.#renderedSecond) return;
		this.#renderedSecond = second;

		const stats = this.#engine.getStats();
		const timed = this.#timedSeconds !== null;
		const clock = timed
			? formatClock(this.#engine.remainingMs, 'down')
			: formatClock(stats.elapsedMs, 'up');

		const hasInput = stats.characters > 0;
		const speedVisible = timed
			? hasInput && stats.elapsedMs >= 1000
			: this.#outcome !== null;
		const speed = speedVisible ? String(Math.round(stats.netWpm)) : '—';
		const accuracy = hasInput ? formatPercent(stats.charAccuracy) : '—';

		text(this.#root.querySelector('[data-lesson-time]'), clock);
		text(this.#root.querySelector('[data-lesson-wpm]'), speed);
		text(this.#root.querySelector('[data-lesson-accuracy]'), accuracy);
		text(this.#root.querySelector('[data-lesson-errors]'), String(stats.errors));
		text(this.#root.querySelector('[data-lesson-q-time]'), clock);
		text(this.#root.querySelector('[data-lesson-q-wpm]'), speed);
		text(this.#root.querySelector('[data-lesson-q-accuracy]'), accuracy);
		text(this.#root.querySelector('[data-lesson-q-errors]'), String(stats.errors));

		const progress = this.#target.length > 0 ? Math.min(100, (stats.characters / this.#target.length) * 100) : 0;
		if (this.#progressFill) this.#progressFill.style.width = `${progress}%`;
		if (this.#meter) this.#meter.setAttribute('aria-valuenow', String(Math.round(progress)));
		text(
			this.#root.querySelector('[data-lesson-progress-label]'),
			`${stats.characters} / ${this.#target.length}`,
		);

		const speedNote = this.#root.querySelector('[data-lesson-speed-note]');
		if (this.#timedSeconds === null) {
			text(
				speedNote,
				this.#outcome !== null
					? `Net WPM across ${this.#target.length} characters.`
					: this.#staticSpeedNote,
			);
		} else {
			text(speedNote, this.#staticSpeedNote);
		}

		text(
			this.#root.querySelector('[data-lesson-hint]'),
			this.#finished
				? 'Finished. Restart for another run, or move on.'
				: this.#engine.isPaused
					? 'Paused — resume when you are ready.'
					: hasInput
						? 'Eyes on the text. Backspace fixes the last character.'
						: 'Click the text, then type.',
		);
	}

	#renderControls(): void {
		const paused = this.#engine.isPaused;
		const canPause = this.#engine.state === 'running' || paused;

		for (const button of this.#pauseButtons) button.disabled = !canPause;
		for (const label of this.#pauseLabels) text(label, paused ? 'Resume' : 'Pause');
		this.#overlay.hidden = !paused;
	}

	#setNextEnabled(enabled: boolean): void {
		for (const button of this.#nextButtons) button.disabled = !enabled;
		if (enabled) {
			const hint = this.#root.querySelector<HTMLElement>('[data-lesson-unlock-hint]');
			if (hint) hint.hidden = true;
		}
	}

	#setStatus(label: string, state: 'idle' | 'active' | 'done' | 'skipped'): void {
		const status = this.#root.querySelector<HTMLElement>('[data-lesson-status]');
		if (!status) return;
		status.textContent = label;
		status.dataset.state = state;
	}

	#applyRecordState(): void {
		this.#record = readLessonRecord(this.#lessonId);

		if (this.#record?.status === 'completed') {
			this.#setStatus('Completed', 'done');
		} else if (this.#record?.status === 'skipped') {
			this.#setStatus('Skipped', 'skipped');
		} else if (this.#record?.status === 'started' && this.#engine.typed.length > 0) {
			this.#setStatus('In progress', 'active');
		} else if (!this.#finished) {
			this.#setStatus('Not started', 'idle');
		}

		if (this.#record?.status === 'completed' || this.#record?.status === 'skipped') {
			this.#nextUnlocked = true;
		}
		this.#setNextEnabled(this.#nextUnlocked);
		this.#renderBest();
	}

	#renderBest(): void {
		const best = this.#root.querySelector<HTMLElement>('[data-lesson-best]');
		if (!best) return;
		const record = this.#record;
		if (!record) {
			best.hidden = true;
			return;
		}

		const parts: string[] = [];
		if (record.bestAccuracy > 0) parts.push(`${formatPercent(record.bestAccuracy)} accuracy`);
		if (record.bestWpm > 0) parts.push(`${Math.round(record.bestWpm)} WPM`);
		if (parts.length === 0) {
			best.hidden = true;
			return;
		}

		const label =
			record.status === 'completed' ? 'Completed' : record.status === 'skipped' ? 'Skipped' : 'Best';
		best.textContent = `${label}: ${parts.join(' · ')}`;
		best.hidden = false;
	}
}

function init(): void {
	for (const root of document.querySelectorAll<HTMLElement>('[data-lesson-studio]')) {
		try {
			new LessonPlayer(root);
		} catch (error) {
			console.error('keysprint: could not start the lesson drill', error);
		}
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}
