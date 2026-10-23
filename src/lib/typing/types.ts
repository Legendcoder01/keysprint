/**
 * Shared types for the typing test engine.
 *
 * Nothing in this module touches the DOM: the engine, the scoring maths and the
 * text corpus are plain TypeScript so they can be unit tested in isolation and
 * reused by every page that embeds a test.
 */

/** Test lengths offered across the site, in seconds. */
export const TEST_DURATIONS = [15, 30, 60, 180, 300, 600] as const;

export type TestDuration = (typeof TEST_DURATIONS)[number];

/** How the practice text is assembled. */
export type TestMode = 'words' | 'sentences' | 'paragraphs';

/** Difficulty tier, mapped to the corpus buckets in `texts.ts`. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Lifecycle of a single test run.
 *
 * `paused` stops the clock and rejects input without touching the buffer.
 */
export type TypingState = 'idle' | 'running' | 'paused' | 'finished';

/** Per-character rendering state. */
export type CharState = 'pending' | 'correct' | 'incorrect';

/** Which hand a key belongs to, in the touch typing model. */
export type Hand = 'left' | 'right';

/** Which finger is meant to press a key, in the touch typing model. */
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

/**
 * How often a single character was pressed during a test.
 *
 * The tally describes what the fingers did, not what ended up on screen: a
 * mistake that was later fixed with backspace still counts as a wrong press.
 */
export interface KeyTally {
	/** Times the character was pressed. */
	pressed: number;
	/** Times the character was pressed and matched the expected character. */
	correct: number;
	/** Times this character was expected but a different one was pressed instead. */
	missed: number;
}

/** Per-character keystroke tallies, keyed by the character itself. */
export type KeyTallies = Record<string, KeyTally>;

/** A complete result for a finished test. */
export interface TypingStats {
	/** Net words per minute — errors removed. This is the headline number. */
	netWpm: number;
	/** Words per minute before errors are removed. */
	grossWpm: number;
	/** Percentage of characters in the buffer that are currently correct. */
	charAccuracy: number;
	/** Percentage of attempted words that are currently correct. */
	wordAccuracy: number;
	/** Percentage of raw keystrokes that were right, counting mistakes you later fixed. */
	keystrokeAccuracy: number;
	/** Characters currently held in the input buffer. */
	characters: number;
	/** Characters in the buffer that do not match the target text. */
	errors: number;
	/** Words currently held in the input buffer. */
	words: number;
	/** Words in the buffer that match the target exactly. */
	correctWords: number;
	/** Total character input events, including characters later deleted. */
	keystrokes: number;
	/** Input events where the character matched the expected character. */
	correctKeystrokes: number;
	/** Elapsed test time in milliseconds. */
	elapsedMs: number;
}

/** Human readable label for a duration, used in headings and buttons. */
export function durationLabel(seconds: TestDuration): string {
	if (seconds < 60) return `${seconds} seconds`;
	const minutes = seconds / 60;
	return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Short label, e.g. "60s" or "3m". */
export function durationShortLabel(seconds: TestDuration): string {
	if (seconds < 60) return `${seconds}s`;
	return `${seconds / 60}m`;
}
