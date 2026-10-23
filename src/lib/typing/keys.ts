import type { Finger, Hand, KeyTallies } from './types';

/**
 * The keyboard model.
 *
 * This is a US QWERTY board with the standard touch typing finger assignment.
 * It exists so the per-key breakdown can answer two questions that a plain
 * error count cannot: which keys are slow, and which finger is responsible.
 *
 * The layout is described as data rather than as a picture, so the same model
 * drives the heat map, the "keys to practise" table and the finger summary.
 */

/** A single key on the board. */
export interface KeyboardKey {
	/** The character the key produces without a modifier. */
	key: string;
	/** The character the key produces while shift is held down. */
	shifted?: string;
	/** Which row the key sits on: 0 numbers, 1 top, 2 home, 3 bottom, 4 space. */
	row: number;
	/** Which hand is meant to press it. */
	hand: Hand;
	/** Which finger is meant to press it. */
	finger: Finger;
}

/** One row of the board. */
export interface KeyboardRow {
	/** Stable identifier for the row. */
	id: 'numbers' | 'top' | 'home' | 'bottom' | 'space';
	/**
	 * Horizontal offset in key widths.
	 *
	 * A real keyboard is staggered: the top row starts about a quarter of a
	 * key further right than the number row, the home row a little further
	 * again, and the bottom row furthest of all. Reproducing that is what
	 * makes the heat map look like a keyboard rather than a table.
	 */
	offset: number;
	/** The keys in the row, from left to right. */
	keys: KeyboardKey[];
}

/** One entry of the layout table: character, hand, finger and shifted form. */
type LayoutEntry = [string, Hand, Finger] | [string, Hand, Finger, string];

function buildRow(
	id: KeyboardRow['id'],
	rowIndex: number,
	offset: number,
	entries: readonly LayoutEntry[],
): KeyboardRow {
	return {
		id,
		offset,
		keys: entries.map(([key, hand, finger, shifted]) => ({
			key,
			// A letter's shifted form is its capital, so it does not have to be
			// listed by hand on all twenty-six of them.
			shifted: shifted ?? (/^[a-z]$/.test(key) ? key.toUpperCase() : undefined),
			row: rowIndex,
			hand,
			finger,
		})),
	};
}

/** The number row, including the key that sits to the left of the digits. */
const NUMBERS = buildRow('numbers', 0, 0, [
	['`', 'left', 'pinky', '~'],
	['1', 'left', 'pinky', '!'],
	['2', 'left', 'ring', '@'],
	['3', 'left', 'middle', '#'],
	['4', 'left', 'index', '$'],
	['5', 'left', 'index', '%'],
	['6', 'right', 'index', '^'],
	['7', 'right', 'index', '&'],
	['8', 'right', 'middle', '*'],
	['9', 'right', 'ring', '('],
	['0', 'right', 'pinky', ')'],
	['-', 'right', 'pinky', '_'],
	['=', 'right', 'pinky', '+'],
]);

/** The top letter row. */
const TOP = buildRow('top', 1, 1.25, [
	['q', 'left', 'pinky'],
	['w', 'left', 'ring'],
	['e', 'left', 'middle'],
	['r', 'left', 'index'],
	['t', 'left', 'index'],
	['y', 'right', 'index'],
	['u', 'right', 'index'],
	['i', 'right', 'middle'],
	['o', 'right', 'ring'],
	['p', 'right', 'pinky'],
	['[', 'right', 'pinky', '{'],
	[']', 'right', 'pinky', '}'],
	['\\', 'right', 'pinky', '|'],
]);

/** The home row, the reference position for every other key. */
const HOME = buildRow('home', 2, 1.5, [
	['a', 'left', 'pinky'],
	['s', 'left', 'ring'],
	['d', 'left', 'middle'],
	['f', 'left', 'index'],
	['g', 'left', 'index'],
	['h', 'right', 'index'],
	['j', 'right', 'index'],
	['k', 'right', 'middle'],
	['l', 'right', 'ring'],
	[';', 'right', 'pinky', ':'],
	["'", 'right', 'pinky', '"'],
]);

/** The bottom letter row. */
const BOTTOM = buildRow('bottom', 3, 1.75, [
	['z', 'left', 'pinky'],
	['x', 'left', 'ring'],
	['c', 'left', 'middle'],
	['v', 'left', 'index'],
	['b', 'left', 'index'],
	['n', 'right', 'index'],
	['m', 'right', 'index'],
	[',', 'right', 'middle', '<'],
	['.', 'right', 'ring', '>'],
	['/', 'right', 'pinky', '?'],
]);

/** The space bar, which is pressed with either thumb. */
const SPACE: KeyboardRow = {
	id: 'space',
	offset: 0,
	keys: [{ key: ' ', row: 4, hand: 'left', finger: 'thumb' }],
};

/** Every row of the board, from the top down. */
export const KEYBOARD_ROWS: readonly KeyboardRow[] = [NUMBERS, TOP, HOME, BOTTOM, SPACE];

/** Every key on the board, in reading order. */
export const ALL_KEYS: readonly KeyboardKey[] = KEYBOARD_ROWS.flatMap((row) => row.keys);

/** The keys that sit on the home row, including the space bar. */
const HOME_ROW_KEYS = new Set(['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ']);

/** The digit keys. */
const DIGIT_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

/** The punctuation keys that are not part of the home row. */
const PUNCTUATION_KEYS = new Set(['-', '=', '[', ']', '\\', "'", '`', ',', '.', '/']);

/** Full name of every finger, used in the breakdown table. */
const FINGER_NAMES: Record<Hand, Record<Finger, string>> = {
	left: {
		pinky: 'left little finger',
		ring: 'left ring finger',
		middle: 'left middle finger',
		index: 'left index finger',
		thumb: 'left thumb',
	},
	right: {
		pinky: 'right little finger',
		ring: 'right ring finger',
		middle: 'right middle finger',
		index: 'right index finger',
		thumb: 'right thumb',
	},
};

/**
 * The accuracy band a percentage falls into.
 *
 * The bands drive the colour scale of the heat map. The thresholds are
 * deliberately generous, because a key that is pressed once or twice in a
 * short test has a wildly unstable percentage.
 */
export type AccuracyBand = 'good' | 'fair' | 'poor' | 'unused';

/** A key at or above this percentage counts as good. */
export const GOOD_ACCURACY = 95;

/** A key at or above this percentage counts as fair. */
export const FAIR_ACCURACY = 85;

/** The band a percentage falls into. */
export function bandFor(accuracy: number, used: boolean): AccuracyBand {
	if (!used) return 'unused';
	if (accuracy >= GOOD_ACCURACY) return 'good';
	if (accuracy >= FAIR_ACCURACY) return 'fair';
	return 'poor';
}

/** Everything the heat map and the tables need to know about one key. */
export interface KeySummary {
	/** The character the key produces. */
	key: string;
	/** The text printed on the key cap. */
	label: string;
	/** Which row the key sits on. */
	row: number;
	/** Which hand is meant to press it. */
	hand: Hand;
	/** Which finger is meant to press it. */
	finger: Finger;
	/** The full name of that finger, for example "right index finger". */
	fingerLabel: string;
	/** Times the key was pressed. */
	pressed: number;
	/** Times the key was pressed and matched the expected character. */
	correct: number;
	/** Times the key was expected but something else was pressed instead. */
	missed: number;
	/**
	 * Accuracy for this key, from 0 to 100.
	 *
	 * `correct / (pressed + missed)`: both hitting the key when it was not
	 * wanted and missing it when it was count against it.
	 */
	accuracy: number;
	/** True when the key was pressed, or was expected and missed, at least once. */
	used: boolean;
	/** The band the accuracy falls into. */
	band: AccuracyBand;
}

/** How a key should be printed on its cap. */
function keyLabel(key: KeyboardKey): string {
	if (key.key === ' ') return 'space';
	return key.key;
}

/**
 * The full name of the finger that presses a key, for example
 * "right index finger". The space bar is shared, so it reads "either thumb".
 */
export function fingerLabelFor(key: KeyboardKey): string {
	if (key.finger === 'thumb' && key.key === ' ') return 'either thumb';
	return FINGER_NAMES[key.hand][key.finger];
}

/**
 * The hand that should hold Shift for this key.
 *
 * Touch typing uses the hand opposite the one pressing the key, so the
 * working hand keeps its position on the home row.
 */
export function shiftHandFor(key: KeyboardKey): Hand {
	return key.hand === 'left' ? 'right' : 'left';
}

/**
 * Look up the key that produces a character.
 *
 * Both the unshifted and the shifted form of every key are matched, so `A`
 * finds the `a` key. Characters that are not on a US QWERTY board return
 * `undefined`.
 */
export function keyForCharacter(char: string): KeyboardKey | undefined {
	return ALL_KEYS.find((key) => key.key === char || key.shifted === char);
}

/**
 * Turn raw keystroke tallies into one summary per key on the board.
 *
 * The shifted and unshifted forms of a key are counted together, because they
 * are the same physical key: pressing shift when the text wanted a lowercase
 * letter is a wrong press of that letter.
 *
 * Accuracy is `correct / (pressed + missed)`. The denominator counts both ways
 * a key can go wrong: hitting it when it was not wanted, and not hitting it
 * when it was. That means a key your fingers never reach — every time it came
 * up, they went somewhere else — shows 0% rather than disappearing from the
 * board, which is exactly the key worth practising.
 */
export function summariseKeys(tallies: KeyTallies): KeySummary[] {
	return ALL_KEYS.map((key) => {
		const plain = tallies[key.key];
		const shifted = key.shifted ? tallies[key.shifted] : undefined;

		const pressed = (plain?.pressed ?? 0) + (shifted?.pressed ?? 0);
		const correct = (plain?.correct ?? 0) + (shifted?.correct ?? 0);
		const missed = (plain?.missed ?? 0) + (shifted?.missed ?? 0);
		const attempts = pressed + missed;
		const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0;

		return {
			key: key.key,
			label: keyLabel(key),
			row: key.row,
			hand: key.hand,
			finger: key.finger,
			fingerLabel: fingerLabelFor(key),
			pressed,
			correct,
			missed,
			accuracy,
			used: attempts > 0,
			band: bandFor(accuracy, attempts > 0),
		};
	});
}

/**
 * Merge several sets of tallies into one.
 *
 * The heat map is built from every test the visitor has run, so the tallies
 * of each of them are added together.
 */
export function mergeTallies(sets: readonly KeyTallies[]): KeyTallies {
	const merged: KeyTallies = {};

	for (const set of sets) {
		for (const [char, tally] of Object.entries(set)) {
			const existing = merged[char];
			if (!existing) {
				merged[char] = {
					pressed: tally.pressed,
					correct: tally.correct,
					missed: tally.missed,
				};
				continue;
			}
			existing.pressed += tally.pressed;
			existing.correct += tally.correct;
			existing.missed += tally.missed;
		}
	}

	return merged;
}

/**
 * The keys that are worth practising.
 *
 * Keys are ranked by accuracy, worst first. A key needs a few presses before
 * its percentage means anything, so keys with real evidence come first and
 * keys that were barely used only fill the remaining places.
 */
export function weakestKeys(
	summaries: readonly KeySummary[],
	limit = 5,
	minPresses = 3,
): KeySummary[] {
	const candidates = summaries.filter((summary) => summary.used && summary.accuracy < 100);

	return [...candidates]
		.sort((a, b) => {
			const aTested = a.pressed + a.missed >= minPresses ? 1 : 0;
			const bTested = b.pressed + b.missed >= minPresses ? 1 : 0;
			return (
				bTested - aTested ||
				a.accuracy - b.accuracy ||
				b.missed - a.missed ||
				b.pressed - a.pressed
			);
		})
		.slice(0, limit);
}

/** Everything the page needs to know about one finger. */
export interface FingerSummary {
	hand: Hand;
	finger: Finger;
	/** The full name of the finger, for example "right index finger". */
	label: string;
	/** Times the keys assigned to this finger were pressed. */
	pressed: number;
	/** Times those presses were right. */
	correct: number;
	/** Times a key assigned to this finger was expected but missed. */
	missed: number;
	/** Accuracy for this finger, from 0 to 100, computed as `correct / (pressed + missed)`. */
	accuracy: number;
}

/**
 * Aggregate the key summaries by finger.
 *
 * The space bar is left out: both thumbs share it, so including it would
 * hide the very thing this summary is for.
 */
export function fingerSummaries(summaries: readonly KeySummary[]): FingerSummary[] {
	const groups = new Map<string, FingerSummary>();

	for (const summary of summaries) {
		if (summary.key === ' ') continue;

		const id = `${summary.hand}-${summary.finger}`;
		let group = groups.get(id);
		if (!group) {
			group = {
				hand: summary.hand,
				finger: summary.finger,
				label: summary.fingerLabel,
				pressed: 0,
				correct: 0,
				missed: 0,
				accuracy: 0,
			};
			groups.set(id, group);
		}

		group.pressed += summary.pressed;
		group.correct += summary.correct;
		group.missed += summary.missed;
	}

	const result = [...groups.values()];
	for (const group of result) {
		const attempts = group.pressed + group.missed;
		group.accuracy = attempts > 0 ? (group.correct / attempts) * 100 : 0;
	}
	return result.sort((a, b) => a.accuracy - b.accuracy);
}

/** The worst performing finger, when there is enough data to name one. */
export function weakestFinger(summaries: readonly KeySummary[]): FingerSummary | null {
	const fingers = fingerSummaries(summaries).filter((finger) => finger.pressed + finger.missed > 0);
	if (fingers.length === 0) return null;
	return fingers[0] ?? null;
}

/** A drill that trains a particular key. */
export interface KeyDrill {
	/** Where the drill lives. */
	href: string;
	/** What the link should say. */
	label: string;
}

/**
 * The drill that most directly trains a key.
 *
 * Home row keys are drilled as a group, digits and punctuation have their own
 * drills, and everything else falls back to the staged curriculum.
 */
export function drillForKey(key: string): KeyDrill {
	if (HOME_ROW_KEYS.has(key)) {
		return { href: '/typing-lessons/home-row/', label: 'Home row drill' };
	}
	if (DIGIT_KEYS.has(key)) {
		return { href: '/typing-practice/numbers/', label: 'Number practice' };
	}
	if (PUNCTUATION_KEYS.has(key)) {
		return { href: '/typing-practice/punctuation/', label: 'Punctuation practice' };
	}
	return { href: '/typing-lessons/', label: 'Typing lessons' };
}
