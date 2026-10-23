import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypingEngine } from '../src/lib/typing/engine';
import {
	ALL_KEYS,
	FAIR_ACCURACY,
	GOOD_ACCURACY,
	bandFor,
	drillForKey,
	fingerSummaries,
	keyForCharacter,
	mergeTallies,
	summariseKeys,
	weakestFinger,
	weakestKeys,
} from '../src/lib/typing/keys';
import type { KeySummary } from '../src/lib/typing/keys';
import { readHistory, writeHistoryEntry } from '../src/lib/storage';
import type { HistoryEntry } from '../src/lib/storage';

/* -------------------------------------------------------------------------
   Test helpers
   ------------------------------------------------------------------------- */

/** Type a string against a target, one character every second. */
function typeString(engine: TypingEngine, input: string): void {
	for (let i = 0; i < input.length; i += 1) {
		engine.type(input[i] ?? '', i * 1_000);
	}
}

/** The summary for one key, which is always present in a full board. */
function summaryFor(summaries: readonly KeySummary[], key: string): KeySummary {
	const summary = summaries.find((entry) => entry.key === key);
	if (!summary) throw new Error(`no summary for "${key}"`);
	return summary;
}

/** A history entry with everything but the tallies filled in. */
function historyEntry(tallies: HistoryEntry['tallies']): HistoryEntry {
	return {
		at: '2026-10-22T10:00:00.000Z',
		durationSeconds: 60,
		drill: 'words',
		netWpm: 60,
		grossWpm: 64,
		charAccuracy: 97,
		keystrokeAccuracy: 95,
		errors: 3,
		characters: 300,
		words: 60,
		elapsedMs: 60_000,
		tallies,
	};
}

/* -------------------------------------------------------------------------
   The engine's raw tallies
   ------------------------------------------------------------------------- */

describe('per-key tally collection', () => {
	it('records a correct press against the key that produced it', () => {
		const engine = new TypingEngine('ab', 60_000);
		typeString(engine, 'ab');

		expect(engine.getKeyTallies()).toEqual({
			a: { pressed: 1, correct: 1, missed: 0 },
			b: { pressed: 1, correct: 1, missed: 0 },
		});
	});

	it('charges a wrong press to both the pressed key and the expected key', () => {
		const engine = new TypingEngine('ab', 60_000);
		// "x" where "a" was wanted: one wrong press of x, one miss for a.
		typeString(engine, 'xb');

		expect(engine.getKeyTallies()).toEqual({
			x: { pressed: 1, correct: 0, missed: 0 },
			a: { pressed: 0, correct: 0, missed: 1 },
			b: { pressed: 1, correct: 1, missed: 0 },
		});
	});

	it('keeps counting a mistake that was corrected with backspace', () => {
		const engine = new TypingEngine('ab', 60_000);
		engine.type('x', 0);
		engine.backspace();
		engine.type('a', 2_000);
		engine.type('b', 3_000);

		const tallies = engine.getKeyTallies();
		expect(tallies.x).toEqual({ pressed: 1, correct: 0, missed: 0 });
		expect(tallies.a).toEqual({ pressed: 1, correct: 1, missed: 1 });
	});

	it('ignores presses beyond the end of the text', () => {
		const engine = new TypingEngine('a', 60_000);
		engine.type('a', 0);
		engine.type('b', 1_000);

		expect(engine.getKeyTallies()).toEqual({ a: { pressed: 1, correct: 1, missed: 0 } });
	});

	it('clears the tallies on reset and keeps them across a text change', () => {
		const engine = new TypingEngine('ab', 60_000);
		engine.type('a', 0);

		engine.reset();
		expect(engine.getKeyTallies()).toEqual({});

		typeString(engine, 'ab');
		expect(Object.keys(engine.getKeyTallies()).sort()).toEqual(['a', 'b']);
	});

	it('hands out a copy, so a caller cannot edit the engine state', () => {
		const engine = new TypingEngine('a', 60_000);
		engine.type('a', 0);

		const tallies = engine.getKeyTallies();
		if (tallies.a) tallies.a.pressed = 999;

		expect(engine.getKeyTallies().a?.pressed).toBe(1);
	});
});

/* -------------------------------------------------------------------------
   Merging stored tests
   ------------------------------------------------------------------------- */

describe('mergeTallies', () => {
	it('adds the tallies of several tests together', () => {
		const merged = mergeTallies([
			{ a: { pressed: 2, correct: 1, missed: 1 } },
			{ a: { pressed: 3, correct: 3, missed: 0 }, b: { pressed: 1, correct: 0, missed: 0 } },
		]);

		expect(merged.a).toEqual({ pressed: 5, correct: 4, missed: 1 });
		expect(merged.b).toEqual({ pressed: 1, correct: 0, missed: 0 });
	});

	it('returns an empty map for no tests', () => {
		expect(mergeTallies([])).toEqual({});
	});

	it('does not mutate the sets it is given', () => {
		const first = { a: { pressed: 1, correct: 1, missed: 0 } };
		mergeTallies([first, { a: { pressed: 1, correct: 0, missed: 0 } }]);

		expect(first.a).toEqual({ pressed: 1, correct: 1, missed: 0 });
	});
});

/* -------------------------------------------------------------------------
   The keyboard model
   ------------------------------------------------------------------------- */

describe('the keyboard model', () => {
	it('gives every key a hand and a finger', () => {
		for (const key of ALL_KEYS) {
			expect(['left', 'right']).toContain(key.hand);
			expect(['pinky', 'ring', 'middle', 'index', 'thumb']).toContain(key.finger);
		}
	});

	it('places every letter of the alphabet exactly once', () => {
		const letters = ALL_KEYS.map((key) => key.key).filter((key) => /^[a-z]$/.test(key));
		expect(letters.sort()).toEqual('abcdefghijklmnopqrstuvwxyz'.split(''));
	});

	it('has no duplicate keys', () => {
		const keys = ALL_KEYS.map((key) => key.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('finds a key from either its plain or shifted form', () => {
		expect(keyForCharacter('a')?.key).toBe('a');
		expect(keyForCharacter('A')?.key).toBe('a');
		expect(keyForCharacter('1')?.key).toBe('1');
		expect(keyForCharacter('!')?.key).toBe('1');
		expect(keyForCharacter('?')?.key).toBe('/');
		expect(keyForCharacter(' ')).toBeDefined();
	});

	it('returns nothing for characters that are not on a US QWERTY board', () => {
		expect(keyForCharacter('£')).toBeUndefined();
		expect(keyForCharacter('—')).toBeUndefined();
	});
});

/* -------------------------------------------------------------------------
   Turning tallies into a breakdown
   ------------------------------------------------------------------------- */

describe('summariseKeys', () => {
	it('returns one summary for every key on the board', () => {
		expect(summariseKeys({})).toHaveLength(ALL_KEYS.length);
	});

	it('scores a key as correct presses over every attempt', () => {
		const summaries = summariseKeys({
			a: { pressed: 8, correct: 8, missed: 0 },
			s: { pressed: 4, correct: 3, missed: 2 },
		});

		// 8 / (8 + 0)
		expect(summaryFor(summaries, 'a').accuracy).toBe(100);
		// 3 / (4 + 2) — one wrong press and two times the key was missed.
		expect(summaryFor(summaries, 's').accuracy).toBeCloseTo(50, 6);
		expect(summaryFor(summaries, 's').pressed).toBe(4);
		expect(summaryFor(summaries, 's').missed).toBe(2);
	});

	it('treats a key that was always missed as used, at zero percent', () => {
		const summaries = summariseKeys({ f: { pressed: 0, correct: 0, missed: 3 } });
		const f = summaryFor(summaries, 'f');

		expect(f.used).toBe(true);
		expect(f.accuracy).toBe(0);
		expect(f.band).toBe('poor');
	});

	it('marks an untouched key as unused', () => {
		const summaries = summariseKeys({});
		const q = summaryFor(summaries, 'q');

		expect(q.used).toBe(false);
		expect(q.band).toBe('unused');
		expect(q.accuracy).toBe(0);
	});

	it('folds the shifted form into the same physical key', () => {
		const summaries = summariseKeys({
			a: { pressed: 2, correct: 2, missed: 0 },
			A: { pressed: 1, correct: 0, missed: 0 },
			'1': { pressed: 1, correct: 1, missed: 0 },
			'!': { pressed: 1, correct: 1, missed: 0 },
		});

		const a = summaryFor(summaries, 'a');
		expect(a.pressed).toBe(3);
		expect(a.correct).toBe(2);
		expect(a.accuracy).toBeCloseTo((2 / 3) * 100, 6);

		const one = summaryFor(summaries, '1');
		expect(one.pressed).toBe(2);
		expect(one.correct).toBe(2);
		expect(one.accuracy).toBe(100);
	});

	it('labels the space bar and its thumbs', () => {
		const space = summaryFor(summariseKeys({ ' ': { pressed: 1, correct: 1, missed: 0 } }), ' ');

		expect(space.label).toBe('space');
		expect(space.fingerLabel).toBe('either thumb');
	});

	it('names the finger that owns each key', () => {
		const summaries = summariseKeys({});

		expect(summaryFor(summaries, 'f').fingerLabel).toBe('left index finger');
		expect(summaryFor(summaries, 'j').fingerLabel).toBe('right index finger');
		expect(summaryFor(summaries, 'a').fingerLabel).toBe('left little finger');
		expect(summaryFor(summaries, '1').fingerLabel).toBe('left little finger');
		expect(summaryFor(summaries, '0').fingerLabel).toBe('right little finger');
	});
});

describe('accuracy bands', () => {
	it('uses the documented thresholds', () => {
		expect(bandFor(100, true)).toBe('good');
		expect(bandFor(GOOD_ACCURACY, true)).toBe('good');
		expect(bandFor(GOOD_ACCURACY - 0.1, true)).toBe('fair');
		expect(bandFor(FAIR_ACCURACY, true)).toBe('fair');
		expect(bandFor(FAIR_ACCURACY - 0.1, true)).toBe('poor');
		expect(bandFor(0, true)).toBe('poor');
	});

	it('reports an untouched key as unused whatever the number says', () => {
		expect(bandFor(0, false)).toBe('unused');
		expect(bandFor(100, false)).toBe('unused');
	});
});

describe('weakestKeys', () => {
	it('lists the worst keys first and skips perfect ones', () => {
		const summaries = summariseKeys({
			a: { pressed: 10, correct: 10, missed: 0 },
			b: { pressed: 10, correct: 9, missed: 1 },
			c: { pressed: 10, correct: 5, missed: 5 },
			d: { pressed: 10, correct: 7, missed: 3 },
		});

		expect(weakestKeys(summaries, 3).map((summary) => summary.key)).toEqual(['c', 'd', 'b']);
	});

	it('prefers keys with enough presses over one unlucky attempt', () => {
		const summaries = summariseKeys({
			a: { pressed: 1, correct: 0, missed: 0 },
			b: { pressed: 10, correct: 9, missed: 1 },
		});

		expect(weakestKeys(summaries, 1).map((summary) => summary.key)).toEqual(['b']);
	});

	it('fills the remaining places with lightly used keys', () => {
		const summaries = summariseKeys({
			a: { pressed: 1, correct: 0, missed: 0 },
			b: { pressed: 10, correct: 9, missed: 1 },
		});

		expect(weakestKeys(summaries, 2).map((summary) => summary.key)).toEqual(['b', 'a']);
	});

	it('falls back to lightly used keys when nothing else has data', () => {
		const summaries = summariseKeys({ a: { pressed: 1, correct: 0, missed: 0 } });

		expect(weakestKeys(summaries, 1).map((summary) => summary.key)).toEqual(['a']);
	});

	it('returns nothing when every key is perfect', () => {
		const summaries = summariseKeys({
			a: { pressed: 10, correct: 10, missed: 0 },
			b: { pressed: 10, correct: 10, missed: 0 },
		});

		expect(weakestKeys(summaries)).toEqual([]);
	});
});

describe('finger summaries', () => {
	it('adds up the keys each finger owns and leaves the space bar out', () => {
		const summaries = summariseKeys({
			j: { pressed: 6, correct: 5, missed: 1 },
			u: { pressed: 2, correct: 2, missed: 0 },
			' ': { pressed: 20, correct: 20, missed: 0 },
		});
		const fingers = fingerSummaries(summaries);
		const rightIndex = fingers.find(
			(finger) => finger.hand === 'right' && finger.finger === 'index',
		);

		expect(rightIndex?.pressed).toBe(8);
		expect(rightIndex?.correct).toBe(7);
		expect(rightIndex?.missed).toBe(1);
		expect(rightIndex?.accuracy).toBeCloseTo((7 / 9) * 100, 6);
		expect(fingers.some((finger) => finger.finger === 'thumb')).toBe(false);
	});

	it('names the least accurate finger', () => {
		const summaries = summariseKeys({
			a: { pressed: 10, correct: 10, missed: 0 },
			p: { pressed: 10, correct: 6, missed: 4 },
		});

		expect(weakestFinger(summaries)?.label).toBe('right little finger');
	});

	it('names no finger when nothing was typed', () => {
		expect(weakestFinger(summariseKeys({}))).toBeNull();
	});
});

describe('drillForKey', () => {
	it('sends home row keys to the home row drill', () => {
		expect(drillForKey('a').href).toBe('/typing-lessons/home-row/');
		expect(drillForKey(';').href).toBe('/typing-lessons/home-row/');
		expect(drillForKey(' ').href).toBe('/typing-lessons/home-row/');
	});

	it('sends digits to the number drill', () => {
		expect(drillForKey('4').href).toBe('/typing-practice/numbers/');
		expect(drillForKey('0').href).toBe('/typing-practice/numbers/');
	});

	it('sends the remaining punctuation to the punctuation drill', () => {
		expect(drillForKey(',').href).toBe('/typing-practice/punctuation/');
		expect(drillForKey('[').href).toBe('/typing-practice/punctuation/');
		expect(drillForKey('/').href).toBe('/typing-practice/punctuation/');
	});

	it('sends every other letter to the lesson index', () => {
		expect(drillForKey('q').href).toBe('/typing-lessons/');
		expect(drillForKey('m').href).toBe('/typing-lessons/');
	});
});

/* -------------------------------------------------------------------------
   Stored history
   ------------------------------------------------------------------------- */

/**
 * A localStorage stand-in.
 *
 * The suite runs in a node environment, so without this the storage helpers
 * would all take their "storage is blocked" path and never be exercised.
 */
class MemoryStorage implements Storage {
	#data = new Map<string, string>();

	get length(): number {
		return this.#data.size;
	}

	clear(): void {
		this.#data.clear();
	}

	getItem(key: string): string | null {
		return this.#data.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.#data.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.#data.delete(key);
	}

	setItem(key: string, value: string): void {
		this.#data.set(key, value);
	}
}

describe('stored history', () => {
	const memory = new MemoryStorage();

	beforeEach(() => {
		memory.clear();
		vi.stubGlobal('window', { localStorage: memory });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps the newest test first and caps the list', () => {
		for (let i = 0; i < 25; i += 1) {
			writeHistoryEntry({ ...historyEntry({}), netWpm: i, at: new Date(2026, 0, i + 1).toISOString() });
		}

		const history = readHistory();
		expect(history).toHaveLength(20);
		expect(history[0]?.netWpm).toBe(24);
		expect(history.at(-1)?.netWpm).toBe(5);
	});

	it('survives damaged data instead of throwing', () => {
		memory.setItem('keysprint.history.v1', '{"not":"an array"}');
		expect(readHistory()).toEqual([]);

		memory.setItem('keysprint.history.v1', '[1, null, {"netWpm": 40}]');
		const history = readHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.netWpm).toBe(40);
		expect(history[0]?.tallies).toEqual({});
	});

	it('drops tally entries that are not numbers', () => {
		memory.setItem(
			'keysprint.history.v1',
			JSON.stringify([
				{
					netWpm: 40,
					tallies: {
						a: { pressed: 3, correct: 2, missed: 1 },
						b: { pressed: 'many', correct: 1, missed: 0 },
					},
				},
			]),
		);

		const history = readHistory();
		expect(history[0]?.tallies).toEqual({ a: { pressed: 3, correct: 2, missed: 1 } });
	});
});
