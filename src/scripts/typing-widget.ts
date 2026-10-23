import { TypingEngine } from '../lib/typing/engine';
import { buildText } from '../lib/typing/selection';
import { DRILL_LABELS } from '../lib/typing/drills';
import type { DrillKind } from '../lib/typing/drills';
import type { Difficulty, TypingStats } from '../lib/typing/types';
import { bestScoreKey, writeBestScore, writeHistoryEntry } from '../lib/storage';
import { playKeystroke, primeKeySound } from './key-sound';

/**
 * The live typing test.
 *
 * Design notes
 * ------------
 * - The engine owns the scoring; this file only translates between the engine
 *   and the DOM.
 * - A keystroke touches at most three elements: the character that was just
 *   typed, the character that was deleted, and the caret. Everything else is
 *   left alone, so the widget stays responsive on long tests.
 * - Completed blocks are collapsed back into plain text once the caret has
 *   moved past them. That keeps the number of live elements proportional to
 *   the text in front of the reader rather than to the length of the test.
 * - All DOM writes for a keystroke happen before the single layout read that
 *   positions the caret, so the browser never has to interleave them.
 */

/** How many blocks are kept expanded after the caret. */
const BLOCKS_AHEAD = 6;

/** How many blocks are kept expanded before the caret. */
const BLOCKS_BEHIND = 2;

function required<T extends Element>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`keysprint: expected an element matching "${selector}"`);
	return element;
}

function setText(root: ParentNode, selector: string, value: string): void {
	const element = root.querySelector(selector);
	if (element) element.textContent = value;
}

/** Format a duration as `m:ss`, counting up to the next whole second. */
function formatClock(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

class TypingWidget {
	readonly root: HTMLElement;
	readonly viewport: HTMLElement;
	readonly track: HTMLElement;
	readonly input: HTMLTextAreaElement;
	readonly area: HTMLElement;
	readonly overlay: HTMLElement;
	readonly startButton: HTMLButtonElement | null;
	readonly exitButton: HTMLButtonElement | null;
	readonly fullscreenButton: HTMLButtonElement | null;
	readonly timeValue: HTMLElement;
	readonly wpmValue: HTMLElement;
	readonly accuracyValue: HTMLElement;
	readonly errorsValue: HTMLElement;
	readonly meter: HTMLElement | null;
	readonly results: HTMLElement;
	readonly status: HTMLElement;
	readonly restartButton: HTMLButtonElement | null;
	readonly againButton: HTMLButtonElement | null;
	readonly newTextButton: HTMLButtonElement | null;
	readonly copyButton: HTMLButtonElement | null;
	readonly bestBadge: HTMLElement | null;

	#engine: TypingEngine;
	#blocks: string[] = [];
	#blockStarts: number[] = [];
	#blockEls: HTMLElement[] = [];
	#expanded = new Map<number, HTMLElement[]>();
	#caretBlock = 0;
	#caretEl: HTMLElement | null = null;
	#lastCaretTop = Number.NaN;
	#lastClock = '';
	#frame = 0;
	#copyTimer = 0;
	#duration: number;
	#drill: DrillKind;
	#difficulty: Difficulty;
	#syncDuration: boolean;
	#started = false;
	/**
	 * True when the browser has no Fullscreen API (iPhone Safari), so the
	 * widget fakes it with a fixed, full-viewport layer instead.
	 */
	#usingFallback = false;
	/** Page elements hidden behind the focus layer, made inert while it is up. */
	#inerted: HTMLElement[] = [];

	constructor(root: HTMLElement) {
		this.root = root;
		this.viewport = required<HTMLElement>(root, '[data-typing-viewport]');
		this.track = required<HTMLElement>(root, '[data-typing-track]');
		this.input = required<HTMLTextAreaElement>(root, '[data-typing-input]');
		this.area = root.querySelector<HTMLElement>('[data-typing-area]') ?? root;
		this.overlay = root.querySelector<HTMLElement>('[data-typing-overlay]') ?? document.createElement('div');
		this.startButton = root.querySelector<HTMLButtonElement>('[data-typing-start]');
		this.exitButton = root.querySelector<HTMLButtonElement>('[data-typing-exit]');
		this.fullscreenButton = root.querySelector<HTMLButtonElement>('[data-typing-fullscreen]');
		this.timeValue = required<HTMLElement>(root, '[data-typing-time]');
		this.wpmValue = required<HTMLElement>(root, '[data-typing-wpm]');
		this.accuracyValue = required<HTMLElement>(root, '[data-typing-accuracy]');
		this.errorsValue = required<HTMLElement>(root, '[data-typing-errors]');
		this.meter = root.querySelector<HTMLElement>('[data-typing-meter]');
		this.results = required<HTMLElement>(root, '[data-typing-results]');
		this.status = required<HTMLElement>(root, '[data-typing-status]');
		this.restartButton = root.querySelector<HTMLButtonElement>('[data-typing-restart]');
		this.againButton = root.querySelector<HTMLButtonElement>('[data-typing-again]');
		this.newTextButton = root.querySelector<HTMLButtonElement>('[data-typing-new]');
		this.copyButton = root.querySelector<HTMLButtonElement>('[data-typing-copy]');
		this.bestBadge = root.querySelector<HTMLElement>('[data-result-best]');

		this.#duration = Number(root.dataset.duration ?? '60') || 60;
		this.#drill = (root.dataset.drill ?? 'words') as DrillKind;
		this.#difficulty = (root.dataset.difficulty ?? 'easy') as Difficulty;
		this.#syncDuration = root.dataset.syncDuration !== 'false';

		this.#engine = new TypingEngine('', this.#duration * 1000);

		this.#applyUrlState();
		this.#loadText();
		this.#bind();
		this.#setReadyState();
		this.#updateFullscreenState();
	}

	// -- setup ---------------------------------------------------------------

	/** Read the length, the text type and the level from the query string. */
	#applyUrlState(): void {
		const params = new URLSearchParams(window.location.search);

		// On the pages where the path already names the length, the length in
		// the query string is ignored so the page and the test always agree.
		const duration = Number(params.get('duration'));
		if (this.#syncDuration && params.has('duration') && Number.isFinite(duration) && duration > 0) {
			this.#duration = duration;
		}

		const mode = params.get('mode');
		if (mode && mode in DRILL_LABELS) {
			this.#drill = mode as DrillKind;
		}

		// The level is only part of the URL when the page offers a choice.
		if (this.#hasGroup('difficulty')) {
			const difficulty = params.get('difficulty');
			if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
				this.#difficulty = difficulty;
			}
		}

		this.#syncControls();
	}

	/** Whether a set of controls is present on this widget. */
	#hasGroup(group: string): boolean {
		return this.root.querySelector(`[data-typing-group="${group}"]`) !== null;
	}

	/** Push the current settings into the radio inputs. */
	#syncControls(): void {
		this.root.querySelectorAll<HTMLInputElement>('input[data-typing-option]').forEach((input) => {
			const group = input.closest('[data-typing-group]')?.getAttribute('data-typing-group');
			let target: string | null = null;
			if (group === 'duration') target = String(this.#duration);
			else if (group === 'mode') target = this.#drill;
			else if (group === 'difficulty') target = this.#difficulty;
			if (target === null) return;
			input.checked = input.value === target;
		});

		// Keep the element's own data attributes in step with the live
		// settings, so the DOM always describes the test that is running.
		this.root.dataset.duration = String(this.#duration);
		this.root.dataset.drill = this.#drill;
		this.root.dataset.difficulty = this.#difficulty;
	}

	/** Write the current settings into the address bar without navigating. */
	#syncUrl(): void {
		if (!window.history?.replaceState) return;
		const url = new URL(window.location.href);
		if (this.#syncDuration) url.searchParams.set('duration', String(this.#duration));
		else url.searchParams.delete('duration');
		url.searchParams.set('mode', this.#drill);
		if (this.#hasGroup('difficulty')) url.searchParams.set('difficulty', this.#difficulty);
		else url.searchParams.delete('difficulty');
		window.history.replaceState(window.history.state, '', url);
	}

	/** Generate a fresh passage and rebuild the widget around it. */
	#loadText(): void {
		const built = buildText({
			durationSeconds: this.#duration,
			drill: this.#drill,
			difficulty: this.#difficulty,
		});

		this.#blocks = [...built.blocks];
		this.#blockStarts = [...built.blockStarts];
		this.#engine = new TypingEngine(built.text, this.#duration * 1000);

		this.track.textContent = '';
		this.#blockEls = [];
		this.#expanded.clear();

		const fragment = document.createDocumentFragment();
		for (let index = 0; index < this.#blocks.length; index += 1) {
			const block = document.createElement('div');
			block.className = 'ts-block';
			fragment.appendChild(block);
			this.#blockEls.push(block);
		}
		this.track.appendChild(fragment);

		this.#resetView();
		this.#setReadyState();
	}

	/** Put the widget back to its starting state. */
	#resetView(): void {
		this.#stopFrame();
		this.#engine.reset();
		this.#started = false;
		this.input.value = '';
		this.input.disabled = true;
		this.results.hidden = true;
		if (this.bestBadge) this.bestBadge.hidden = true;
		this.#caretBlock = 0;
		this.#caretEl = null;
		this.#lastCaretTop = Number.NaN;
		this.#lastClock = '';
		this.#syncWindow(0);
		this.#updateCaret();
		this.track.style.transform = 'translate3d(0, 0, 0)';
		if (this.meter) this.meter.style.transform = 'scaleX(1)';
		this.#renderStats();
		this.#renderClock();
		this.status.textContent = '';
	}

	#setReadyState(): void {
		this.#started = false;
		this.#stopFrame();
		this.#engine.reset();
		this.input.value = '';
		this.input.disabled = true;
		this.area.dataset.state = 'ready';
		if (this.startButton) {
			this.startButton.disabled = false;
			this.startButton.focus({ preventScroll: true });
		}
		this.#lastClock = '';
		this.timeValue.textContent = formatClock(this.#duration * 1000);
		if (this.meter) this.meter.style.transform = 'scaleX(1)';
		this.#renderStats();
		this.status.textContent = '';
	}

	#startTest(): void {
		if (this.#started && this.area.dataset.state === 'running') {
			this.input.focus();
			return;
		}
		this.#started = true;
		this.area.dataset.state = 'running';
		this.input.disabled = false;
		this.input.focus({ preventScroll: true });
		// Starting a test takes over the screen, so the page chrome disappears
		// and there is nothing left to read but the passage.
		this.#enterFocusMode();
	}

	/** Whether the widget is currently filling the screen. */
	#isFocusActive(): boolean {
		return this.#usingFallback || document.fullscreenElement === this.root;
	}

	/**
	 * Put the test on the whole screen.
	 *
	 * The request runs inside the Start click, which is what counts as user
	 * activation. If the browser refuses it (no API on iPhone Safari, an
	 * embedded frame, a permission policy) the fixed-layer fallback takes over
	 * instead, so the result is the same: only the test is visible.
	 */
	#enterFocusMode(): void {
		if (this.#isFocusActive()) return;

		if (this.root.requestFullscreen) {
			try {
				const request = this.root.requestFullscreen();
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
		// Without native fullscreen the page still scrolls behind the fixed
		// layer, which leaves a scrollbar peeking out on the right. Lock it.
		document.documentElement.classList.add('ts-fallback');
		this.#updateFullscreenState();
	}

	/** Leave full screen without touching the run in progress. */
	#exitFocusMode(): void {
		if (document.fullscreenElement) {
			const exit = document.exitFullscreen();
			void exit?.then(() => this.#restoreFocus());
			return;
		}

		if (this.#usingFallback) {
			this.#usingFallback = false;
			document.documentElement.classList.remove('ts-fallback');
			this.#updateFullscreenState();
			this.#restoreFocus();
		}
	}

	#toggleFullscreen(): void {
		if (this.#isFocusActive()) {
			this.#exitFocusMode();
			return;
		}
		this.#enterFocusMode();
	}

	/** Send focus to whatever the user would reach for next. */
	#restoreFocus(): void {
		const state = this.area.dataset.state;
		if (state === 'running') {
			this.input.focus({ preventScroll: true });
			return;
		}
		if (state === 'ready') {
			this.startButton?.focus({ preventScroll: true });
			return;
		}
		this.results.querySelector<HTMLButtonElement>('[data-typing-again]')?.focus({ preventScroll: true });
	}

	#updateFullscreenState(): void {
		const active = this.#isFocusActive();
		const wasActive = this.root.dataset.focus === 'true';

		if (this.fullscreenButton) {
			this.fullscreenButton.setAttribute('aria-pressed', active ? 'true' : 'false');
			this.fullscreenButton.textContent = active ? 'Exit Full Screen' : 'Full Screen';
		}
		this.root.dataset.focus = active ? 'true' : 'false';
		this.root.dataset.fullscreen = active ? 'true' : 'false';

		// The page behind the focus layer is covered on screen; take it out of
		// the tab order and the accessibility tree too.
		this.#setPageInert(active);

		// Entering full screen can move focus to the browser's own container.
		// Put it back on the input (or the Start button) so the next keystroke
		// lands where the user expects.
		if (active && !wasActive) this.#restoreFocus();
	}

	#setPageInert(active: boolean): void {
		if (!active) {
			for (const element of this.#inerted) element.inert = false;
			this.#inerted = [];
			return;
		}

		if (this.#inerted.length > 0) return;

		// Walk from the widget up to <body>, marking every sibling along the
		// way. Everything except the test itself becomes unreachable.
		let node: Element | null = this.root;
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

	// -- rendering -----------------------------------------------------------

	/** The text of a block, including the trailing space that joins it to the next one. */
	#blockText(index: number): string {
		const block = this.#blocks[index] ?? '';
		return index < this.#blocks.length - 1 ? `${block} ` : block;
	}

	/** Find the block a global character index belongs to. */
	#blockIndexOf(globalIndex: number): number {
		const starts = this.#blockStarts;
		if (starts.length === 0) return 0;

		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = Math.ceil((low + high) / 2);
			if ((starts[middle] ?? 0) <= globalIndex) low = middle;
			else high = middle - 1;
		}
		return low;
	}

	/**
	 * Expand the blocks around the caret and collapse the ones behind it.
	 *
	 * Collapsing replaces the character spans with a single text node. The
	 * text and the styling stay the same, so the layout does not move, but the
	 * number of live elements stops growing with the length of the test.
	 */
	#syncWindow(caretBlock: number): void {
		const first = Math.max(0, caretBlock - BLOCKS_BEHIND);
		const last = Math.min(this.#blocks.length - 1, caretBlock + BLOCKS_AHEAD);

		for (const index of [...this.#expanded.keys()]) {
			if (index >= first) continue;
			const element = this.#blockEls[index];
			if (element) element.textContent = this.#blockText(index);
			this.#expanded.delete(index);
		}

		for (let index = first; index <= last; index += 1) {
			if (!this.#expanded.has(index)) this.#expandBlock(index);
		}
	}

	/** Build the character spans for one block and apply the current state. */
	#expandBlock(index: number): void {
		const element = this.#blockEls[index];
		if (!element) return;

		const text = this.#blockText(index);
		const start = this.#blockStarts[index] ?? 0;
		const fragment = document.createDocumentFragment();
		const characters: HTMLElement[] = [];

		for (let offset = 0; offset < text.length; offset += 1) {
			const span = document.createElement('span');
			span.className = 'ts-char';
			span.textContent = text.charAt(offset);
			fragment.appendChild(span);
			characters.push(span);
		}

		// The final block gets one extra empty slot so the caret can sit at
		// the very end of the passage.
		if (index === this.#blocks.length - 1) {
			const slot = document.createElement('span');
			slot.className = 'ts-char';
			fragment.appendChild(slot);
			characters.push(slot);
		}

		element.textContent = '';
		element.appendChild(fragment);
		this.#expanded.set(index, characters);

		const typed = this.#engine.typed;
		const target = this.#engine.text;
		for (let offset = 0; offset < text.length; offset += 1) {
			const span = characters[offset];
			if (span) this.#paintChar(span, typed.charAt(start + offset) || undefined, target.charAt(start + offset) || undefined);
		}
	}

	/** Colour a single character according to what has been typed. */
	#paintChar(element: HTMLElement, typedChar: string | undefined, targetChar: string | undefined): void {
		if (typedChar === undefined) {
			element.className = 'ts-char';
			element.removeAttribute('aria-invalid');
			element.textContent = targetChar ?? '';
			return;
		}

		element.textContent = typedChar;
		const correct = typedChar === targetChar;
		element.className = correct ? 'ts-char is-correct' : 'ts-char is-incorrect';

		// Colour is not the only signal: an incorrect character also carries
		// the invalid state, and the running error count is announced.
		if (correct) {
			element.removeAttribute('aria-invalid');
		} else {
			element.setAttribute('aria-invalid', 'true');
		}
	}

	/** Repaint one character after a keystroke. */
	#updateChar(globalIndex: number): void {
		if (globalIndex < 0 || globalIndex >= this.#engine.text.length) return;

		const blockIndex = this.#blockIndexOf(globalIndex);
		const characters = this.#expanded.get(blockIndex);
		if (!characters) return;

		const offset = globalIndex - (this.#blockStarts[blockIndex] ?? 0);
		const element = characters[offset];
		if (!element) return;

		this.#paintChar(
			element,
			this.#engine.typed.charAt(globalIndex) || undefined,
			this.#engine.text.charAt(globalIndex) || undefined,
		);
	}

	/** Move the caret marker onto the next character. */
	#updateCaret(): void {
		if (this.#caretEl) this.#caretEl.classList.remove('is-current');
		this.#caretEl = null;

		const index = this.#engine.cursor;
		const blockIndex = this.#blockIndexOf(index);
		const characters = this.#expanded.get(blockIndex);
		if (!characters) return;

		const offset = index - (this.#blockStarts[blockIndex] ?? 0);
		const element = characters[offset];
		if (!element) return;

		element.classList.add('is-current');
		this.#caretEl = element;
	}

	/**
	 * Keep the caret inside the visible window.
	 *
	 * This is the only layout read in the keystroke path. It happens after the
	 * writes for the keystroke are already on the page, so the browser performs
	 * a single style and layout pass instead of thrashing.
	 *
	 * The caret is held about a third of the way down the window, which leaves
	 * a line of context above it. Near the start of the passage that would mean
	 * scrolling the first line out of view, so the top of the text is the hard
	 * limit in that direction.
	 */
	#scrollToCaret(): void {
		const element = this.#caretEl;
		if (!element) return;

		const top = element.offsetTop;
		if (top === this.#lastCaretTop) return;
		this.#lastCaretTop = top;

		const styles = window.getComputedStyle(this.viewport);
		const padTop = Number.parseFloat(styles.paddingTop) || 0;
		const padBottom = Number.parseFloat(styles.paddingBottom) || 0;
		const height = this.viewport.clientHeight - padTop - padBottom;
		const contentHeight = this.track.scrollHeight;

		const desired = Math.round(height / 3) - top;
		const lowest = Math.min(0, height - contentHeight);
		const offset = Math.max(lowest, Math.min(0, desired));

		this.track.style.transform = `translate3d(0, ${Math.round(offset)}px, 0)`;
	}

	/** Repaint everything that changed because of one keystroke. */
	#paint(changedIndex: number): void {
		const caretBlock = this.#blockIndexOf(this.#engine.cursor);
		if (caretBlock !== this.#caretBlock) {
			this.#caretBlock = caretBlock;
			this.#syncWindow(caretBlock);
		}

		if (changedIndex >= 0) this.#updateChar(changedIndex);

		this.#updateCaret();
		this.#scrollToCaret();
		this.#renderStats();
	}

	#renderStats(): void {
		const stats = this.#engine.getStats();

		// The clock starts on the very first keystroke, so for the first
		// moments of a test the elapsed time is a fraction of a second and
		// the derived speed is meaningless. Showing it anyway would flash a
		// number in the thousands, so the speed stays blank until there is
		// enough of a sample to mean something.
		const settled = stats.elapsedMs >= 1000;
		this.wpmValue.textContent = settled ? String(Math.round(stats.netWpm)) : '—';
		this.accuracyValue.textContent = stats.characters > 0 ? `${stats.charAccuracy.toFixed(1)}%` : '—';
		this.errorsValue.textContent = String(stats.errors);
	}

	#renderClock(): void {
		if (this.area.dataset.state !== 'running') {
			return;
		}
		const text = formatClock(this.#engine.remainingMs);
		if (text === this.#lastClock) return;
		this.#lastClock = text;
		this.timeValue.textContent = text;

		const duration = this.#engine.durationMs;
		if (this.meter && duration > 0) {
			if (this.area.dataset.state === 'running') {
				const fraction = Math.max(0, Math.min(1, this.#engine.remainingMs / duration));
				this.meter.style.transform = `scaleX(${fraction.toFixed(4)})`;
			} else {
				this.meter.style.transform = 'scaleX(1)';
			}
		}

		// Speed is an average over the elapsed time, so it keeps moving even
		// when the hands stop. Repaint it with the clock, otherwise a pause
		// leaves the readout frozen on the last keystroke.
		this.#renderStats();
	}

	// -- clock ---------------------------------------------------------------

	#startFrame(): void {
		if (this.#frame !== 0) return;
		const loop = () => {
			this.#frame = window.requestAnimationFrame(loop);
			this.#tick();
		};
		this.#frame = window.requestAnimationFrame(loop);
	}

	#stopFrame(): void {
		if (this.#frame === 0) return;
		window.cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	#tick(): void {
		const now = performance.now();
		if (this.#engine.tick(now)) {
			this.#stopFrame();
			this.#finish();
			return;
		}
		this.#renderClock();
	}

	// -- input ---------------------------------------------------------------

	#bind(): void {
		this.input.addEventListener('keydown', (event) => {
			this.#onKeyDown(event);
		});
		this.input.addEventListener('paste', (event) => {
			event.preventDefault();
		});
		this.input.addEventListener('input', () => {
			// The widget handles every keystroke itself, so the field should
			// never hold anything the engine has not seen.
			this.input.value = this.#engine.typed;
		});

		// The sample is warmed on the first interaction, when the browser is
		// willing to decode audio.
		for (const type of ['pointerdown', 'keydown', 'touchstart'] as const) {
			window.addEventListener(type, () => primeKeySound(), { once: true, passive: true });
		}

		this.startButton?.addEventListener('click', () => {
			this.#startTest();
		});

		this.fullscreenButton?.addEventListener('click', () => {
			this.#toggleFullscreen();
		});

		this.exitButton?.addEventListener('click', () => {
			this.#exitFocusMode();
		});

		document.addEventListener('fullscreenchange', () => {
			this.#updateFullscreenState();
		});

		// The fallback layer has no browser chrome to dismiss, so Escape is
		// wired up by hand.
		window.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !this.#usingFallback) return;
			event.preventDefault();
			this.#exitFocusMode();
		});

		this.root.addEventListener('change', (event) => {
			this.#onChange(event);
		});

		this.root.addEventListener('click', (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest('.ts-area') && this.area.dataset.state === 'running') {
				this.input.focus();
			}
		});

		// A resize changes how the blocks wrap, and with it the visual line the
		// caret sits on. Recompute the offset instead of leaving the passage
		// scrolled to a line that no longer exists.
		window.addEventListener('resize', () => {
			this.#lastCaretTop = Number.NaN;
			this.#scrollToCaret();
		});

		this.restartButton?.addEventListener('click', () => {
			this.#newText();
			this.#setReadyState();
		});
		this.againButton?.addEventListener('click', () => {
			this.#restartSame();
		});
		this.newTextButton?.addEventListener('click', () => {
			this.#newText();
		});
		this.copyButton?.addEventListener('click', () => {
			this.#copyResult();
		});
	}

	#onKeyDown(event: KeyboardEvent): void {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key === 'Tab') return;

		if (this.area.dataset.state === 'ready') {
			event.preventDefault();
			this.#startTest();
			return;
		}

		if (this.#engine.state === 'finished') {
			event.preventDefault();
			if (event.key === 'Enter') this.#restartSame();
			return;
		}

		if (event.key === 'Backspace') {
			event.preventDefault();
			this.#handleBackspace();
			return;
		}

		if (event.key.length === 1) {
			event.preventDefault();
			this.#handleChar(event.key);
			return;
		}

		// Arrow keys, Enter and the rest have no meaning inside a test.
		event.preventDefault();
	}

	#handleChar(char: string): void {
		if (this.area.dataset.state !== 'running') {
			this.#startTest();
		}
		const now = performance.now();
		const index = this.#engine.type(char, now);
		if (index < 0) return;

		playKeystroke(char, char === this.#engine.text[index], now);
		this.input.value = this.#engine.typed;
		this.#paint(index);
		this.#startFrame();

		if (this.#engine.typed.length >= this.#engine.text.length) {
			this.#stopFrame();
			this.#engine.finish(performance.now());
			this.#finish();
		}
	}

	#handleBackspace(): void {
		const index = this.#engine.backspace();
		if (index < 0) return;

		this.input.value = this.#engine.typed;
		this.#paint(index);
	}

	#onChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) || !target.checked) return;

		const group = target.closest('[data-typing-group]')?.getAttribute('data-typing-group');
		if (group === 'duration') {
			const value = Number(target.value);
			if (!Number.isFinite(value) || value <= 0) return;
			this.#duration = value;
		} else if (group === 'mode') {
			this.#drill = target.value as DrillKind;
		} else if (group === 'difficulty') {
			this.#difficulty = target.value as Difficulty;
		} else {
			return;
		}

		this.#syncControls();
		this.#syncUrl();
		this.#loadText();
		this.#setReadyState();
	}

	// -- finishing -----------------------------------------------------------

	#finish(): void {
		const stats = this.#engine.getStats();
		this.area.dataset.state = 'completed';
		this.#fillResults(stats);
		this.results.hidden = false;
		this.input.disabled = true;

		// The animation loop stops with the test, so the clock and the meter are
		// put back to zero by hand rather than left on their last frame.
		this.timeValue.textContent = '0:00';
		this.#lastClock = '0:00';
		if (this.meter) this.meter.style.transform = 'scaleX(0)';

		const isRecord = writeBestScore(bestScoreKey(this.#duration, this.#drill), stats.netWpm);
		if (this.bestBadge) this.bestBadge.hidden = !isRecord;

		// The finished test is kept on this device so the per-key breakdown
		// has real data to work from. It never leaves the browser.
		writeHistoryEntry({
			at: new Date().toISOString(),
			durationSeconds: this.#duration,
			drill: this.#drill,
			netWpm: stats.netWpm,
			grossWpm: stats.grossWpm,
			charAccuracy: stats.charAccuracy,
			keystrokeAccuracy: stats.keystrokeAccuracy,
			errors: stats.errors,
			characters: stats.characters,
			words: stats.words,
			elapsedMs: stats.elapsedMs,
			tallies: this.#engine.getKeyTallies(),
		});

		this.status.textContent = `Test complete. ${Math.round(stats.netWpm)} net words per minute, ${stats.charAccuracy.toFixed(1)} percent character accuracy, ${stats.errors} errors.`;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.results.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
	}

	#fillResults(stats: TypingStats): void {
		setText(this.root, '[data-result-wpm]', String(Math.round(stats.netWpm)));
		setText(this.root, '[data-result-gross]', `${Math.round(stats.grossWpm)} WPM`);
		setText(this.root, '[data-result-char-accuracy]', `${stats.charAccuracy.toFixed(1)}%`);
		setText(this.root, '[data-result-word-accuracy]', `${stats.wordAccuracy.toFixed(1)}%`);
		setText(this.root, '[data-result-keystroke-accuracy]', `${stats.keystrokeAccuracy.toFixed(1)}%`);
		setText(this.root, '[data-result-errors]', String(stats.errors));
		setText(this.root, '[data-result-characters]', String(stats.characters));
		setText(this.root, '[data-result-words]', String(stats.words));
		setText(this.root, '[data-result-time]', formatClock(stats.elapsedMs));
		setText(this.root, '[data-result-config]', `${this.#duration}s ${DRILL_LABELS[this.#drill]}`);
	}

	#restartSame(): void {
		this.#resetView();
		this.#setReadyState();
	}

	#newText(): void {
		this.#loadText();
		this.#setReadyState();
	}

	#copyResult(): void {
		const stats = this.#engine.getStats();
		const summary = [
			`keysprint — ${this.#duration}s ${DRILL_LABELS[this.#drill]} test`,
			`${Math.round(stats.netWpm)} WPM net (${Math.round(stats.grossWpm)} WPM gross)`,
			`${stats.charAccuracy.toFixed(1)}% character accuracy, ${stats.words} words typed`,
			window.location.href,
		].join('\n');

		const clipboard = navigator.clipboard;
		if (!clipboard) {
			this.#flashCopy('Copy unavailable');
			return;
		}

		void clipboard.writeText(summary).then(
			() => this.#flashCopy('Copied'),
			() => this.#flashCopy('Copy failed'),
		);
	}

	#flashCopy(label: string): void {
		const button = this.copyButton;
		if (!button) return;
		button.textContent = label;
		window.clearTimeout(this.#copyTimer);
		this.#copyTimer = window.setTimeout(() => {
			button.textContent = 'Copy result';
		}, 2000);
	}
}

function init(): void {
	document.querySelectorAll<HTMLElement>('[data-typing-test]').forEach((root) => {
		new TypingWidget(root);
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}
