import {
	charAccuracy,
	countCorrect,
	countErrors,
	grossWpm,
	keystrokeAccuracy,
	netWpm,
	wordAccuracy,
} from './scoring';
import type { CharState, KeyTally, KeyTallies, TypingState, TypingStats } from './types';

/**
 * The typing test engine.
 *
 * Deliberately free of any DOM reference: it takes a timestamp on every call
 * so the caller decides how time advances (the widget uses
 * `requestAnimationFrame`, the tests use a fake clock). That keeps the scoring
 * logic deterministic and unit testable.
 *
 * State machine
 * -------------
 *   idle      nothing typed yet, the clock has not started
 *   running   the clock is running, characters are being accepted
 *   paused    the clock is stopped and input is rejected, but the buffer and
 *             the time already spent are kept
 *   finished  the clock expired or the caller ended the run; the engine
 *             ignores all further input
 *
 * A pause never discards the buffer. Paused milliseconds are subtracted from
 * {@link TypingEngine.elapsedMs}, so a pause cannot lower a WPM score.
 */
export class TypingEngine {
	#text: string;
	#durationMs: number;
	#state: TypingState = 'idle';
	#typed = '';
	#keystrokes = 0;
	#correctKeystrokes = 0;
	#startedAt: number | null = null;
	#finishedAt: number | null = null;
	#lastKnownNow: number | null = null;
	#pausedAt: number | null = null;
	#pausedTotal = 0;
	#keyTallies = new Map<string, KeyTally>();

	constructor(text: string, durationMs: number) {
		this.#text = text;
		this.#durationMs = Math.max(0, durationMs);
	}

	/** The target text the user is typing towards. */
	get text(): string {
		return this.#text;
	}

	/** Everything the user has typed and not yet deleted. */
	get typed(): string {
		return this.#typed;
	}

	get state(): TypingState {
		return this.#state;
	}

	get durationMs(): number {
		return this.#durationMs;
	}

	/** Number of characters the user has entered, including deleted ones. */
	get keystrokes(): number {
		return this.#keystrokes;
	}

	/** Characters in the buffer that currently differ from the target. */
	get errorCount(): number {
		return countErrors(this.#typed, this.#text);
	}

	/** Index of the next character the user should type. */
	get cursor(): number {
		return Math.min(this.#typed.length, this.#text.length);
	}

	/** True while the clock is intentionally stopped. */
	get isPaused(): boolean {
		return this.#state === 'paused';
	}

	/** Milliseconds left on the clock. Never negative. */
	get remainingMs(): number {
		if (this.#state === 'idle') return this.#durationMs;
		return Math.max(0, this.#durationMs - this.elapsedMs);
	}

	/**
	 * Milliseconds since the clock started, excluding paused time.
	 *
	 * Zero before the first keystroke. While paused the clock freezes at the
	 * moment of the pause, so the readout does not creep forward behind the
	 * pause overlay.
	 */
	get elapsedMs(): number {
		if (this.#startedAt === null) return 0;
		const end =
			this.#finishedAt ??
			(this.#state === 'paused' ? this.#pausedAt : this.#lastKnownNow) ??
			this.#startedAt;
		return Math.max(0, end - this.#startedAt - this.#pausedTotal);
	}

	/**
	 * Start the clock. Called automatically on the first keystroke, but exposed
	 * so a widget can start a test the moment the user focuses the input.
	 */
	start(now: number): void {
		if (this.#state !== 'idle') return;
		this.#state = 'running';
		this.#startedAt = now;
		this.#lastKnownNow = now;
	}

	/**
	 * Stop the clock without touching the buffer.
	 *
	 * Only a running test can be paused: pausing an idle test would start a
	 * clock that has not begun, and pausing a finished one has no meaning.
	 */
	pause(now: number): void {
		if (this.#state !== 'running') return;
		this.#state = 'paused';
		this.#pausedAt = now;
		this.#lastKnownNow = now;
	}

	/**
	 * Restart the clock after a pause, keeping every typed character.
	 *
	 * The gap between {@link pause} and this call is added to the excluded
	 * time, so it never appears in the elapsed total or in a WPM score.
	 */
	resume(now: number): void {
		if (this.#state !== 'paused' || this.#pausedAt === null) return;
		this.#pausedTotal += Math.max(0, now - this.#pausedAt);
		this.#pausedAt = null;
		this.#lastKnownNow = now;
		this.#state = 'running';
	}

	/**
	 * Rebuild a run from a persisted draft.
	 *
	 * Used when the page is reloaded mid-lesson: the typed buffer, the time
	 * already spent and the raw keystroke counters are put back exactly as
	 * they were, and the clock continues from `now`.
	 *
	 * The values are treated as untrusted: the buffer is clipped to the
	 * target, counters are clamped, and non-finite numbers fall back to zero.
	 */
	restore(
		typed: string,
		elapsedMs: number,
		keystrokes: number,
		correctKeystrokes: number,
		now: number,
	): void {
		const restored = typed.slice(0, this.#text.length);
		const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

		this.#typed = restored;
		this.#keyTallies.clear();
		this.#pausedAt = null;
		this.#pausedTotal = 0;
		this.#finishedAt = null;

		const rawKeystrokes = Number.isFinite(keystrokes)
			? Math.floor(keystrokes)
			: restored.length;
		this.#keystrokes = Math.max(restored.length, 0, rawKeystrokes);

		const rawCorrect = Number.isFinite(correctKeystrokes)
			? Math.floor(correctKeystrokes)
			: countCorrect(restored, this.#text);
		this.#correctKeystrokes = Math.max(0, Math.min(this.#keystrokes, rawCorrect));

		if (restored.length === 0) {
			// An empty draft is not a run: keep the idle counters at zero so the
			// keystroke accuracy of the next attempt is not diluted by a stale one.
			this.#keystrokes = 0;
			this.#correctKeystrokes = 0;
			this.#state = 'idle';
			this.#startedAt = null;
			this.#lastKnownNow = null;
			return;
		}

		this.#state = 'running';
		this.#startedAt = now - elapsed;
		this.#lastKnownNow = now;
	}

	/**
	 * Clear the buffer and put the engine back in its idle state.
	 *
	 * The target text is kept, so the same passage can be typed again. Use
	 * {@link TypingEngine.setText} to swap in a different passage.
	 */
	reset(): void {
		this.#typed = '';
		this.#keystrokes = 0;
		this.#correctKeystrokes = 0;
		this.#keyTallies.clear();
		this.#state = 'idle';
		this.#startedAt = null;
		this.#finishedAt = null;
		this.#lastKnownNow = null;
		this.#pausedAt = null;
		this.#pausedTotal = 0;
	}

	/**
	 * Replace the target text and reset the test.
	 */
	setText(text: string, durationMs: number = this.#durationMs): void {
		this.#text = text;
		this.#durationMs = Math.max(0, durationMs);
		this.reset();
	}

	/**
	 * Record a character input.
	 *
	 * Returns the index of the character that was just typed so the caller can
	 * update only that span in the DOM.
	 */
	type(char: string, now: number): number {
		if (this.#state === 'finished' || this.#state === 'paused') return -1;
		if (this.#state === 'idle') this.start(now);

		const index = this.#typed.length;
		this.#typed += char;
		this.#keystrokes += 1;
		if (char === this.#text[index]) this.#correctKeystrokes += 1;
		this.#recordKeyPress(char, this.#text[index]);
		this.#lastKnownNow = now;

		return index;
	}

	/**
	 * Attribute one keystroke to the key it belongs to.
	 *
	 * A press is counted against the key that was actually pressed, so
	 * reaching for `j` when `f` was expected is recorded as a wrong `j` and a
	 * missed `f`. That is what makes the per-key breakdown useful: it shows
	 * which key your fingers actually go to, not only which characters you
	 * failed to produce.
	 */
	#recordKeyPress(char: string, expected: string | undefined): void {
		// A press beyond the end of the text has no key to be right or wrong
		// about, so it is not part of the breakdown.
		if (expected === undefined) return;

		const pressed = this.#tally(char);
		pressed.pressed += 1;

		if (char === expected) {
			pressed.correct += 1;
			return;
		}

		this.#tally(expected).missed += 1;
	}

	/** The tally for one character, created on first use. */
	#tally(char: string): KeyTally {
		let tally = this.#keyTallies.get(char);
		if (!tally) {
			tally = { pressed: 0, correct: 0, missed: 0 };
			this.#keyTallies.set(char, tally);
		}
		return tally;
	}

	/**
	 * Delete the last character.
	 *
	 * The keystroke counters are intentionally left alone: they describe what
	 * your fingers did, not what ended up on screen. Backspacing to fix a typo
	 * raises character accuracy but does not erase the mistake from the raw
	 * keystroke tally.
	 */
	backspace(): number {
		if (this.#state === 'finished' || this.#state === 'paused' || this.#typed.length === 0) {
			return -1;
		}
		this.#typed = this.#typed.slice(0, -1);
		return this.#typed.length;
	}

	/**
	 * Advance the engine to the given point in time.
	 *
	 * Returns `true` when this call ended the test, so the caller can render
	 * the results exactly once. Calling it again after the test has finished
	 * never ends it a second time.
	 */
	tick(now: number): boolean {
		if (this.#state !== 'running') return false;
		this.#lastKnownNow = now;

		// Paused time is added to the deadline as well as removed from the
		// elapsed total, so a paused test does not lose time off its clock.
		const deadline = (this.#startedAt ?? now) + this.#pausedTotal + this.#durationMs;
		if (now >= deadline) {
			// Finish on the deadline rather than on the current timestamp. A
			// backgrounded tab can deliver a late frame, and counting that gap
			// as typing time would understate the score.
			this.finish(deadline);
			return true;
		}

		return false;
	}

	/** End the test. Subsequent input is ignored. */
	finish(now: number): void {
		if (this.#state === 'finished') return;
		if (this.#state === 'idle') {
			this.#startedAt = now;
		}

		// If the run ends while paused, the clock stopped at the pause. Using
		// the later timestamp would count the paused gap as typing time.
		const end = this.#state === 'paused' ? (this.#pausedAt ?? now) : now;

		this.#state = 'finished';
		this.#finishedAt = end;
		this.#lastKnownNow = end;
		this.#pausedAt = null;
	}

	/** Full statistics for the current state of the test. */
	getStats(): TypingStats {
		const characters = this.#typed.length;
		const errors = countErrors(this.#typed, this.#text);
		const words = wordAccuracy(this.#typed, this.#text);
		const elapsedMs = this.elapsedMs;

		return {
			netWpm: netWpm(characters, errors, elapsedMs),
			grossWpm: grossWpm(characters, elapsedMs),
			charAccuracy: charAccuracy(characters, errors),
			wordAccuracy: words.total > 0 ? (words.correct / words.total) * 100 : 0,
			keystrokeAccuracy: keystrokeAccuracy(this.#correctKeystrokes, this.#keystrokes),
			characters,
			errors,
			words: words.total,
			correctWords: words.correct,
			keystrokes: this.#keystrokes,
			correctKeystrokes: this.#correctKeystrokes,
			elapsedMs,
		};
	}

	/** Per-character state for the target text, for rendering. */
	getCharacterStates(): CharState[] {
		const states: CharState[] = new Array(this.#text.length).fill('pending');
		for (let i = 0; i < this.#typed.length && i < this.#text.length; i += 1) {
			states[i] = this.#typed[i] === this.#text[i] ? 'correct' : 'incorrect';
		}
		return states;
	}

	/**
	 * Per-character keystroke tallies for the test so far.
	 *
	 * This is the raw material for the keyboard heat map. Each character that
	 * was pressed has an entry, even when the press was wrong, and the
	 * character that was expected but not produced is credited with a miss.
	 */
	getKeyTallies(): KeyTallies {
		const tallies: KeyTallies = {};
		for (const [char, tally] of this.#keyTallies) {
			tallies[char] = { pressed: tally.pressed, correct: tally.correct, missed: tally.missed };
		}
		return tallies;
	}
}

export type { CharState } from './types';
