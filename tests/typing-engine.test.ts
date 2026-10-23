import { describe, expect, it } from 'vitest';
import { TypingEngine } from '../src/lib/typing/engine';
import {
	charAccuracy,
	countCorrect,
	countErrors,
	grossWpm,
	keystrokeAccuracy,
	netWpm,
	percentage,
	wordAccuracy,
} from '../src/lib/typing/scoring';

describe('scoring formulas', () => {
	it('reports gross WPM as characters per five divided by minutes', () => {
		// 300 characters in one minute = 300 / 5 = 60 WPM.
		expect(grossWpm(300, 60_000)).toBeCloseTo(60, 6);
		// 300 characters in 30 seconds = 120 WPM.
		expect(grossWpm(300, 30_000)).toBeCloseTo(120, 6);
	});

	it('discounts errors from net WPM', () => {
		expect(netWpm(300, 0, 60_000)).toBeCloseTo(60, 6);
		// 300 characters with 50 errors leaves 250 correct characters = 50 WPM.
		expect(netWpm(300, 50, 60_000)).toBeCloseTo(50, 6);
	});

	it('never returns Infinity or NaN for degenerate input', () => {
		expect(grossWpm(0, 60_000)).toBe(0);
		expect(grossWpm(100, 0)).toBe(0);
		expect(grossWpm(100, -5)).toBe(0);
		expect(netWpm(0, 0, 0)).toBe(0);
		expect(charAccuracy(0, 0)).toBe(0);
		expect(keystrokeAccuracy(0, 0)).toBe(0);
		expect(percentage(0, 0)).toBe(0);
	});

	it('computes character accuracy from the buffer', () => {
		expect(charAccuracy(100, 0)).toBe(100);
		expect(charAccuracy(100, 10)).toBe(90);
		expect(charAccuracy(10, 10)).toBe(0);
	});

	it('computes raw keystroke accuracy independently of corrections', () => {
		expect(keystrokeAccuracy(95, 100)).toBe(95);
		expect(keystrokeAccuracy(0, 0)).toBe(0);
	});

	it('counts a word as correct only when every character matches', () => {
		const result = wordAccuracy('the quick brpwn fox', 'the quick brown fox');
		expect(result.total).toBe(4);
		expect(result.correct).toBe(3);
	});

	it('does not count a partial trailing word as correct', () => {
		const result = wordAccuracy('the quick bro', 'the quick brown');
		expect(result.total).toBe(3);
		expect(result.correct).toBe(2);
	});

	it('reports zero words for an empty buffer', () => {
		expect(wordAccuracy('', 'the quick brown')).toEqual({ correct: 0, total: 0 });
	});

	it('counts mismatched characters, including characters past the end of the target', () => {
		expect(countErrors('abc', 'abc')).toBe(0);
		expect(countErrors('abd', 'abc')).toBe(1);
		expect(countErrors('abcde', 'abc')).toBe(2);
		expect(countCorrect('abd', 'abc')).toBe(2);
		expect(countCorrect('abcde', 'abc')).toBe(3);
	});
});

describe('TypingEngine', () => {
	const TARGET = 'abcdefghij';

	it('starts idle and does not run the clock until the first keystroke', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		expect(engine.state).toBe('idle');
		expect(engine.elapsedMs).toBe(0);
		expect(engine.remainingMs).toBe(60_000);
	});

	it('accepts characters and tracks the buffer', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		expect(engine.type('a', 0)).toBe(0);
		expect(engine.type('b', 10)).toBe(1);
		expect(engine.typed).toBe('ab');
		expect(engine.state).toBe('running');
		expect(engine.elapsedMs).toBe(10);
	});

	it('removes the last character on backspace', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('b', 10);
		expect(engine.backspace()).toBe(1);
		expect(engine.typed).toBe('a');
		expect(engine.backspace()).toBe(0);
		expect(engine.typed).toBe('');
	});

	it('ignores backspace on an empty buffer', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		expect(engine.backspace()).toBe(-1);
		expect(engine.typed).toBe('');
	});

	it('ends the test exactly when the clock expires and only once', () => {
		const engine = new TypingEngine(TARGET, 1_000);
		engine.type('a', 0);

		expect(engine.tick(999)).toBe(false);
		expect(engine.state).toBe('running');

		expect(engine.tick(1_000)).toBe(true);
		expect(engine.state).toBe('finished');

		// A later tick must not report a second completion.
		expect(engine.tick(5_000)).toBe(false);
		expect(engine.state).toBe('finished');
	});

	it('never reports a negative remaining time', () => {
		const engine = new TypingEngine(TARGET, 1_000);
		engine.type('a', 0);
		engine.tick(10_000);
		expect(engine.remainingMs).toBe(0);
		expect(engine.elapsedMs).toBe(1_000);
	});

	it('ignores input once the test has finished', () => {
		const engine = new TypingEngine(TARGET, 1_000);
		engine.type('a', 0);
		engine.tick(1_000);

		expect(engine.type('b', 1_500)).toBe(-1);
		expect(engine.backspace()).toBe(-1);
		expect(engine.typed).toBe('a');
	});

	it('reports the expected statistics for a perfect run', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		for (let i = 0; i < TARGET.length; i += 1) {
			engine.type(TARGET.charAt(i), i * 1_000);
		}
		engine.finish(60_000);

		const stats = engine.getStats();
		expect(stats.netWpm).toBeCloseTo(2, 6);
		expect(stats.grossWpm).toBeCloseTo(2, 6);
		expect(stats.charAccuracy).toBe(100);
		expect(stats.wordAccuracy).toBe(100);
		expect(stats.keystrokeAccuracy).toBe(100);
		expect(stats.characters).toBe(10);
		expect(stats.errors).toBe(0);
		expect(stats.keystrokes).toBe(10);
		expect(stats.elapsedMs).toBe(60_000);
	});

	it('separates gross speed, net speed and accuracy when a character is wrong', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		let index = 0;
		for (const char of 'abcdefghXj') {
			engine.type(char, index * 1_000);
			index += 1;
		}
		engine.finish(60_000);

		const stats = engine.getStats();
		// Ten characters typed, one of them wrong.
		expect(stats.grossWpm).toBeCloseTo(2, 6);
		expect(stats.netWpm).toBeCloseTo(1.8, 6);
		expect(stats.charAccuracy).toBeCloseTo(90, 6);
		expect(stats.keystrokeAccuracy).toBeCloseTo(90, 6);
		// The word no longer matches, so word accuracy drops to zero.
		expect(stats.wordAccuracy).toBe(0);
		expect(stats.errors).toBe(1);
	});

	it('raises character accuracy when a mistake is deleted but keeps the raw keystroke record', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		let index = 0;
		for (const char of 'abcdefghX') {
			engine.type(char, index * 1_000);
			index += 1;
		}
		engine.backspace();

		const stats = engine.getStats();
		expect(stats.characters).toBe(8);
		expect(stats.errors).toBe(0);
		expect(stats.charAccuracy).toBe(100);
		// The wrong keystroke still happened, so raw accuracy stays below 100.
		expect(stats.keystrokes).toBe(9);
		expect(stats.keystrokeAccuracy).toBeCloseTo(88.888888, 5);
	});

	it('reports zero words and zero accuracy when nothing was typed', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.finish(60_000);
		const stats = engine.getStats();
		expect(stats.characters).toBe(0);
		expect(stats.words).toBe(0);
		expect(stats.correctWords).toBe(0);
		expect(stats.netWpm).toBe(0);
	});

	it('exposes per-character states for rendering', () => {
		const engine = new TypingEngine('abcd', 60_000);
		engine.type('a', 0);
		engine.type('X', 1);

		const states = engine.getCharacterStates();
		expect(states[0]).toBe('correct');
		expect(states[1]).toBe('incorrect');
		expect(states[2]).toBe('pending');
		expect(states[3]).toBe('pending');
	});

	it('clears the buffer and the clock on reset but keeps the passage', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('X', 1_000);
		engine.backspace();

		engine.reset();

		expect(engine.typed).toBe('');
		expect(engine.text).toBe(TARGET);
		expect(engine.state).toBe('idle');
		expect(engine.elapsedMs).toBe(0);
		expect(engine.remainingMs).toBe(60_000);
		expect(engine.keystrokes).toBe(0);

		const stats = engine.getStats();
		expect(stats.characters).toBe(0);
		expect(stats.errors).toBe(0);
		expect(stats.keystrokes).toBe(0);
		expect(stats.keystrokeAccuracy).toBe(0);
	});

	it('accepts fresh input after a reset', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.reset();

		expect(engine.type('a', 5_000)).toBe(0);
		expect(engine.typed).toBe('a');
		expect(engine.state).toBe('running');
		// The clock restarts from the first keystroke of the new attempt.
		expect(engine.elapsedMs).toBe(0);
	});

	it('swaps the passage and resets on setText', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('b', 100);

		engine.setText('wxyz');

		expect(engine.text).toBe('wxyz');
		expect(engine.typed).toBe('');
		expect(engine.state).toBe('idle');
		expect(engine.elapsedMs).toBe(0);
		expect(engine.keystrokes).toBe(0);
		expect(engine.durationMs).toBe(60_000);
	});

	it('can change the length together with the passage on setText', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.setText('wxyz', 15_000);

		expect(engine.text).toBe('wxyz');
		expect(engine.durationMs).toBe(15_000);
		expect(engine.remainingMs).toBe(15_000);
	});
});

describe('TypingEngine pause and resume', () => {
	const TARGET = 'abcdefghij';

	it('freezes the clock while paused and keeps the buffer', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('b', 400);
		expect(engine.elapsedMs).toBe(400);

		engine.pause(400);
		expect(engine.isPaused).toBe(true);
		expect(engine.state).toBe('paused');
		expect(engine.typed).toBe('ab');
		expect(engine.elapsedMs).toBe(400);

		engine.resume(5_000);
		expect(engine.state).toBe('running');
		// The 4.6-second gap is excluded, so the clock is still at 400ms.
		expect(engine.elapsedMs).toBe(400);
	});

	it('counts time again after resuming', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.pause(400);
		engine.resume(5_000);
		engine.tick(5_200);

		expect(engine.elapsedMs).toBe(600);
	});

	it('rejects input while paused without losing what was typed', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.pause(100);

		expect(engine.type('b', 200)).toBe(-1);
		expect(engine.backspace()).toBe(-1);
		expect(engine.typed).toBe('a');
		expect(engine.keystrokes).toBe(1);

		engine.resume(300);
		expect(engine.type('b', 400)).toBe(1);
		expect(engine.typed).toBe('ab');
	});

	it('does not start an idle or finished test by pausing it', () => {
		const idle = new TypingEngine(TARGET, 60_000);
		idle.pause(100);
		expect(idle.state).toBe('idle');

		const done = new TypingEngine(TARGET, 60_000);
		done.type('a', 0);
		done.finish(500);
		done.pause(600);
		expect(done.state).toBe('finished');
	});

	it('moves the deadline out by exactly the paused time', () => {
		const engine = new TypingEngine(TARGET, 1_000);
		engine.type('a', 0);
		engine.pause(400);
		engine.resume(5_000);

		expect(engine.remainingMs).toBe(600);
		expect(engine.tick(5_599)).toBe(false);
		expect(engine.tick(5_600)).toBe(true);
		expect(engine.elapsedMs).toBe(1_000);
	});

	it('ignores resume when the test is not paused', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.resume(5_000);

		expect(engine.state).toBe('running');
		expect(engine.elapsedMs).toBe(0);
	});

	it('freezes elapsed time when a paused test is finished', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('b', 500);
		engine.pause(500);
		engine.finish(9_000);

		expect(engine.state).toBe('finished');
		expect(engine.elapsedMs).toBe(500);

		const stats = engine.getStats();
		expect(stats.elapsedMs).toBe(500);
		expect(stats.characters).toBe(2);
	});

	it('clears the pause state on reset', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.pause(100);
		engine.reset();

		expect(engine.state).toBe('idle');
		expect(engine.isPaused).toBe(false);
		expect(engine.elapsedMs).toBe(0);
		expect(engine.type('a', 5_000)).toBe(0);
		expect(engine.elapsedMs).toBe(0);
	});
});

describe('TypingEngine restore', () => {
	const TARGET = 'abcdefghij';

	it('rebuilds the buffer, the elapsed time and the raw counters', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.restore('abc', 1_500, 5, 3, 10_000);

		expect(engine.state).toBe('running');
		expect(engine.typed).toBe('abc');
		expect(engine.elapsedMs).toBe(1_500);
		expect(engine.remainingMs).toBe(58_500);

		const stats = engine.getStats();
		expect(stats.characters).toBe(3);
		expect(stats.keystrokes).toBe(5);
		expect(stats.correctKeystrokes).toBe(3);

		// The clock keeps running from the restored point.
		engine.tick(12_500);
		expect(engine.elapsedMs).toBe(4_000);
	});

	it('treats the stored numbers as untrusted', () => {
		const engine = new TypingEngine('abcdefghij', 60_000);
		engine.restore('abcdefghijklm', Number.NaN, -4, 40, 1_000);

		expect(engine.typed).toBe('abcdefghij');
		expect(engine.elapsedMs).toBe(0);
		expect(engine.keystrokes).toBe(10);
		expect(engine.getStats().correctKeystrokes).toBe(10);
		expect(engine.getStats().keystrokeAccuracy).toBe(100);
	});

	it('falls back to the buffer when the counters are missing', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.restore('abc', 100, Number.POSITIVE_INFINITY, Number.NaN, 1_000);

		const stats = engine.getStats();
		expect(stats.keystrokes).toBe(3);
		expect(stats.correctKeystrokes).toBe(3);
	});

	it('stays idle for an empty draft and does not leak stale counters', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('b', 10);
		engine.backspace();

		const dirty = new TypingEngine(TARGET, 60_000);
		dirty.restore('', 5_000, 9, 8, 10_000);

		expect(dirty.state).toBe('idle');
		expect(dirty.elapsedMs).toBe(0);
		expect(dirty.remainingMs).toBe(60_000);
		expect(dirty.getStats().keystrokes).toBe(0);
		expect(dirty.getStats().keystrokeAccuracy).toBe(0);
	});

	it('can be paused straight after a restore', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.restore('abc', 1_000, 3, 3, 4_000);
		engine.pause(4_000);

		expect(engine.isPaused).toBe(true);
		expect(engine.elapsedMs).toBe(1_000);

		engine.resume(20_000);
		expect(engine.elapsedMs).toBe(1_000);
		engine.tick(20_500);
		expect(engine.elapsedMs).toBe(1_500);
	});
});

describe('TypingEngine completion guards', () => {
	const TARGET = 'abcdefghij';

	it('sets the elapsed time once and never changes it afterwards', () => {
		const engine = new TypingEngine(TARGET, 5_000);
		engine.type('a', 0);
		engine.tick(5_000);
		expect(engine.elapsedMs).toBe(5_000);

		engine.tick(50_000);
		engine.finish(99_000);
		engine.type('b', 99_500);

		expect(engine.elapsedMs).toBe(5_000);
		expect(engine.state).toBe('finished');
	});

	it('does not change the score after finishing', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		let index = 0;
		for (const char of TARGET) {
			engine.type(char, index * 100);
			index += 1;
		}
		engine.finish(2_000);
		const before = engine.getStats();

		engine.tick(30_000);
		engine.type('X', 30_100);
		engine.backspace();
		engine.finish(30_200);
		const after = engine.getStats();

		expect(after).toEqual(before);
		expect(after.netWpm).toBeGreaterThan(0);
		expect(Number.isFinite(after.netWpm)).toBe(true);
	});

	it('reports an untouched run as finished without dividing by zero', () => {
		const engine = new TypingEngine(TARGET, 1_000);
		// The clock never starts without input, so this run ends at zero.
		expect(engine.tick(1_000)).toBe(false);
		engine.finish(1_000);
		expect(engine.state).toBe('finished');

		const stats = engine.getStats();
		expect(stats.characters).toBe(0);
		expect(stats.elapsedMs).toBe(0);
		expect(stats.netWpm).toBe(0);
		expect(stats.grossWpm).toBe(0);
		expect(stats.charAccuracy).toBe(0);
		expect(stats.keystrokeAccuracy).toBe(0);
		expect(Number.isFinite(stats.netWpm)).toBe(true);
	});

	it('ends an untimed run once, at the requested time', () => {
		const engine = new TypingEngine(TARGET, Number.POSITIVE_INFINITY);
		engine.type('a', 0);
		engine.type('b', 1_000);

		// An untimed engine never expires, however far the clock advances.
		expect(engine.tick(3_600_000)).toBe(false);
		expect(engine.state).toBe('running');
		expect(engine.remainingMs).toBe(Number.POSITIVE_INFINITY);

		engine.finish(1_200);
		expect(engine.state).toBe('finished');
		expect(engine.elapsedMs).toBe(1_200);
		expect(engine.finish(9_000)).toBeUndefined();
		expect(engine.elapsedMs).toBe(1_200);
	});

	it('never reports a NaN or negative statistic mid-run', () => {
		const engine = new TypingEngine(TARGET, 60_000);
		engine.type('a', 0);
		engine.type('X', 0);
		engine.backspace();

		const stats = engine.getStats();
		for (const value of Object.values(stats)) {
			expect(Number.isFinite(value), `statistic ${value}`).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
		}
	});
});
