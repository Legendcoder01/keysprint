import { KEYBOARD_ROWS } from './keys';
import type { KeyboardKey } from './keys';

/**
 * The printable on-screen keyboard.
 *
 * `keys.ts` models only the character keys, because that is all the accuracy
 * analysis needs. A lesson needs the whole board: the modifier row, Tab, Caps
 * Lock, both Shift keys, Enter and Backspace, with realistic widths.
 *
 * This module adds those keys without changing the canonical finger map. The
 * character keys are copied straight out of {@link KEYBOARD_ROWS}, so the
 * highlighted key in a lesson is the same key the heat map reports on.
 */

export interface BoardKey {
	/** Stable identifier used by the player to highlight the key. */
	id: string;
	/** The unshifted character, when this is a character key. */
	char?: string;
	/** The shifted character, when this is a character key. */
	shifted?: string;
	/** Text printed on the cap. */
	label: string;
	/** Width in key units. A standard letter key is 1. */
	width: number;
	/** True for Tab, Caps, Shift, Enter, Backspace, Ctrl, Alt and Space. */
	modifier: boolean;
	/** True for the F and J home-row markers. */
	home: boolean;
	/** True when the shifted glyph should be printed above the primary one. */
	stacked: boolean;
}

export interface BoardRow {
	id: string;
	/** Left padding in key units, used to stagger the rows. */
	offset: number;
	keys: BoardKey[];
}

function modifierKey(
	id: string,
	label: string,
	width: number,
): BoardKey {
	return { id, label, width, modifier: true, home: false, stacked: false };
}

/** Pads the familiar wide keys: Tab, Caps, Shift, Enter, Backspace, Ctrl, Alt. */
const TAB = modifierKey('Tab', 'Tab', 1.5);
const CAPS = modifierKey('CapsLock', 'Caps', 1.75);
const ENTER = modifierKey('Enter', 'Enter', 2.25);
const BACKSPACE = modifierKey('Backspace', 'Bksp', 2);
const SHIFT_LEFT = modifierKey('ShiftLeft', 'Shift', 2.25);
const SHIFT_RIGHT = modifierKey('ShiftRight', 'Shift', 2.75);
const CTRL_LEFT = modifierKey('ControlLeft', 'Ctrl', 1.5);
const CTRL_RIGHT = modifierKey('ControlRight', 'Ctrl', 1.5);
const ALT_LEFT = modifierKey('AltLeft', 'Alt', 1.5);
const ALT_RIGHT = modifierKey('AltRight', 'Alt', 1.5);

const SPACE: BoardKey = {
	id: 'Space',
	char: ' ',
	label: 'space',
	width: 7,
	modifier: true,
	home: false,
	stacked: false,
};

/** Turn a canonical key into a printable cap. */
function fromKey(key: KeyboardKey): BoardKey {
	const letter = /^[a-z]$/.test(key.key);
	return {
		id: key.key,
		char: key.key,
		...(key.shifted ? { shifted: key.shifted } : {}),
		label: letter ? key.key.toUpperCase() : key.key,
		width: 1,
		modifier: false,
		home: key.key === 'f' || key.key === 'j',
		stacked: Boolean(key.shifted && !letter),
	};
}

function keysOf(id: 'numbers' | 'top' | 'home' | 'bottom'): BoardKey[] {
	const row = KEYBOARD_ROWS.find((candidate) => candidate.id === id);
	return row ? row.keys.map(fromKey) : [];
}

const NUMBERS_ROW: BoardRow = {
	id: 'numbers',
	offset: 0,
	keys: [...keysOf('numbers'), BACKSPACE],
};

const TOP_ROW: BoardRow = {
	id: 'top',
	offset: 0.25,
	keys: [TAB, ...keysOf('top')],
};

const HOME_ROW: BoardRow = {
	id: 'home',
	offset: 0,
	keys: [CAPS, ...keysOf('home'), ENTER],
};

const BOTTOM_ROW: BoardRow = {
	id: 'bottom',
	offset: 0,
	keys: [SHIFT_LEFT, ...keysOf('bottom'), SHIFT_RIGHT],
};

/** The modifier row is narrower than the letter rows on a real board. */
const SPACE_ROW: BoardRow = {
	id: 'space',
	offset: 1,
	keys: [CTRL_LEFT, ALT_LEFT, SPACE, ALT_RIGHT, CTRL_RIGHT],
};

/** Every row of the on-screen keyboard, top to bottom. */
export const BOARD_ROWS: readonly BoardRow[] = [
	NUMBERS_ROW,
	TOP_ROW,
	HOME_ROW,
	BOTTOM_ROW,
	SPACE_ROW,
];

/** Every printable key, in reading order. */
export const BOARD_KEYS: readonly BoardKey[] = BOARD_ROWS.flatMap((row) => row.keys);
