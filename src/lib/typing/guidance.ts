import { ALL_KEYS, fingerLabelFor, keyForCharacter, shiftHandFor } from './keys';
import type { KeyboardKey } from './keys';
import type { Finger, Hand } from './types';

/**
 * Turning the next expected character into concrete finger guidance.
 *
 * The lesson player asks one question on every keystroke: which physical key
 * is next, which hand and finger owns it, and does it need Shift? The answer
 * comes from the same keyboard model as the heat map, so the highlighted key,
 * the finger label and the hand guide can never disagree with the analysis
 * pages.
 */

/** The space bar is not produced by `keyForCharacter` without a lookup. */
const SPACE_KEY = ALL_KEYS.find((key) => key.key === ' ');

export interface KeyGuidance {
	/** The character the learner should type (a space is kept as " "). */
	char: string;
	/** How the character is printed in the interface. */
	label: string;
	/** The physical key, when the character exists on a US QWERTY board. */
	key: KeyboardKey | null;
	/** The key's unshifted character, used to match the on-screen board. */
	keyId: string;
	/** Which hand presses the key. */
	hand: Hand | null;
	/** Which finger presses the key. */
	finger: Finger | null;
	/** Long finger name, for example "left middle finger". */
	fingerLabel: string | null;
	/** True when the character needs Shift held down. */
	shift: boolean;
	/** The hand that should hold Shift, opposite the typing hand. */
	shiftHand: Hand | null;
	/** False for characters that are not on the keyboard, such as emoji. */
	supported: boolean;
}

/** Guidance for a character that cannot be found on the keyboard. */
function unsupported(char: string): KeyGuidance {
	return {
		char,
		label: char === ' ' ? 'space' : char,
		key: null,
		keyId: char,
		hand: null,
		finger: null,
		fingerLabel: null,
		shift: false,
		shiftHand: null,
		supported: false,
	};
}

/**
 * Describe the physical action needed to type one character.
 *
 * `guidanceFor('A')` and `guidanceFor('a')` both point at the A key, but the
 * first sets `shift` and names the right hand as the Shift hand.
 */
export function guidanceFor(char: string): KeyGuidance {
	if (char.length === 0) return unsupported(char);

	if (char === ' ') {
		if (!SPACE_KEY) return unsupported(char);
		return {
			char,
			label: 'space',
			key: SPACE_KEY,
			keyId: 'Space',
			hand: SPACE_KEY.hand,
			finger: SPACE_KEY.finger,
			fingerLabel: fingerLabelFor(SPACE_KEY),
			shift: false,
			shiftHand: null,
			supported: true,
		};
	}

	const key = keyForCharacter(char);
	if (!key || key.key === ' ') return unsupported(char);

	const shift = char !== key.key;

	return {
		char,
		label: char,
		key,
		keyId: key.key,
		hand: key.hand,
		finger: key.finger,
		fingerLabel: fingerLabelFor(key),
		shift,
		shiftHand: shift ? shiftHandFor(key) : null,
		supported: true,
	};
}

/**
 * Every character in a piece of practice text that is not on the board.
 *
 * Lessons are written against the printed layout, so this should be empty.
 * It is exported so a test can prove that a new lesson never silently asks
 * for a character the keyboard guide cannot show.
 */
export function unsupportedCharacters(text: string): string[] {
	const missing = new Set<string>();
	for (const char of text) {
		if (char === '\n' || char === '\t') {
			missing.add(JSON.stringify(char));
			continue;
		}
		if (!guidanceFor(char).supported) missing.add(char);
	}
	return [...missing];
}
