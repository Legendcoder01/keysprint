/**
 * Scoring maths for the typing test.
 *
 * Every formula the site reports is defined here, in one place, so the numbers
 * shown in the results panel can be explained on the page itself and verified
 * by unit tests.
 *
 * Definitions
 * -----------
 * characters        characters currently in the input buffer
 * errors            characters in the buffer that differ from the target text
 * keystrokes        character input events in total, including characters that
 *                   were later deleted with backspace
 * correctKeystrokes input events where the character matched the expected one
 * words             whitespace separated words currently in the buffer
 * correctWords      words in the buffer that match the target word exactly
 * minutes           elapsed test time expressed in minutes
 *
 * Formulas
 * --------
 * gross WPM      = (characters / 5) / minutes
 * net WPM        = ((characters - errors) / 5) / minutes
 * char accuracy  = (characters - errors) / characters * 100
 * word accuracy  = correctWords / words * 100
 * key accuracy   = correctKeystrokes / keystrokes * 100
 */

/** Standard conversion: one "word" is five characters. */
export const CHARACTERS_PER_WORD = 5;

/** One minute in milliseconds. */
export const MS_PER_MINUTE = 60_000;

/**
 * Words per minute before errors are discounted.
 * Returns 0 for a non-positive elapsed time so the result can never be
 * `Infinity` or `NaN`.
 */
export function grossWpm(characters: number, elapsedMs: number): number {
	if (characters <= 0 || elapsedMs <= 0) return 0;
	const minutes = elapsedMs / MS_PER_MINUTE;
	return characters / CHARACTERS_PER_WORD / minutes;
}

/**
 * Words per minute with incorrect characters removed from the count.
 * This is the number a typist should trust: it rewards accuracy.
 */
export function netWpm(characters: number, errors: number, elapsedMs: number): number {
	if (characters <= 0 || elapsedMs <= 0) return 0;
	const minutes = elapsedMs / MS_PER_MINUTE;
	const correct = Math.max(0, characters - errors);
	return correct / CHARACTERS_PER_WORD / minutes;
}

/**
 * Percentage of the characters currently in the buffer that are correct.
 * A buffer holding nothing but correct characters scores 100.
 */
export function charAccuracy(characters: number, errors: number): number {
	if (characters <= 0) return 0;
	const correct = Math.max(0, characters - errors);
	return (correct / characters) * 100;
}

/**
 * Percentage of raw keystrokes that were correct.
 * Unlike {@link charAccuracy} this keeps counting mistakes that were later
 * fixed with backspace, so it reflects raw keyboard accuracy.
 */
export function keystrokeAccuracy(correctKeystrokes: number, keystrokes: number): number {
	if (keystrokes <= 0) return 0;
	return (Math.min(correctKeystrokes, keystrokes) / keystrokes) * 100;
}

export interface WordAccuracy {
	/** Words in the buffer that match the target word at the same position. */
	correct: number;
	/** Words in the buffer. */
	total: number;
}

/**
 * Compare the buffer against the target word by word.
 * A word only counts as correct when every character in it is right, so fixing
 * a single letter restores the word.
 */
export function wordAccuracy(typed: string, target: string): WordAccuracy {
	const typedWords = typed.split(/\s+/).filter((word) => word.length > 0);
	const targetWords = target.split(/\s+/).filter((word) => word.length > 0);
	if (typedWords.length === 0) return { correct: 0, total: 0 };

	let correct = 0;
	for (let i = 0; i < typedWords.length; i += 1) {
		if (typedWords[i] === targetWords[i]) correct += 1;
	}

	return { correct, total: typedWords.length };
}

/**
 * Count the characters in `typed` that do not match the target.
 * Characters typed past the end of the target count as errors.
 */
export function countErrors(typed: string, target: string): number {
	let errors = 0;
	for (let i = 0; i < typed.length; i += 1) {
		if (typed[i] !== target[i]) errors += 1;
	}
	return errors;
}

/**
 * Count the characters in `typed` that match the target.
 * Characters typed past the end of the target never match.
 */
export function countCorrect(typed: string, target: string): number {
	let correct = 0;
	for (let i = 0; i < typed.length; i += 1) {
		if (typed[i] === target[i]) correct += 1;
	}
	return correct;
}

/** Percentage helper that never returns `NaN`. */
export function percentage(part: number, total: number): number {
	if (total <= 0) return 0;
	return (part / total) * 100;
}
