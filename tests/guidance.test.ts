import { describe, expect, it } from 'vitest';
import { guidanceFor, unsupportedCharacters } from '../src/lib/typing/guidance';
import { LESSONS } from '../src/lib/lessons';

/**
 * The lesson guide has one job: turn the next character into the physical key,
 * hand, finger and Shift hand the learner should use. A wrong answer here would
 * point at the wrong key, so these tests are deliberately concrete.
 */

describe('guidanceFor', () => {
	it('maps a home-row letter to its key, hand and finger', () => {
		const guidance = guidanceFor('a');
		expect(guidance.supported).toBe(true);
		expect(guidance.keyId).toBe('a');
		expect(guidance.hand).toBe('left');
		expect(guidance.finger).toBe('pinky');
		expect(guidance.fingerLabel).toBe('left little finger');
		expect(guidance.shift).toBe(false);
		expect(guidance.shiftHand).toBeNull();
	});

	it('uses the opposite hand for Shift on a capital', () => {
		const guidance = guidanceFor('A');
		expect(guidance.supported).toBe(true);
		expect(guidance.keyId).toBe('a');
		expect(guidance.hand).toBe('left');
		expect(guidance.shift).toBe(true);
		expect(guidance.shiftHand).toBe('right');
	});

	it('maps shifted punctuation to the base key and the opposite Shift hand', () => {
		const colon = guidanceFor(':');
		expect(colon.supported).toBe(true);
		expect(colon.keyId).toBe(';');
		expect(colon.hand).toBe('right');
		expect(colon.finger).toBe('pinky');
		expect(colon.shift).toBe(true);
		expect(colon.shiftHand).toBe('left');

		const percent = guidanceFor('%');
		expect(percent.keyId).toBe('5');
		expect(percent.hand).toBe('left');
		expect(percent.finger).toBe('index');
		expect(percent.shiftHand).toBe('right');
	});

	it('points at the space bar and names either thumb', () => {
		const guidance = guidanceFor(' ');
		expect(guidance.supported).toBe(true);
		expect(guidance.keyId).toBe('Space');
		expect(guidance.finger).toBe('thumb');
		expect(guidance.fingerLabel).toBe('either thumb');
		expect(guidance.label).toBe('space');
		expect(guidance.shift).toBe(false);
	});

	it('marks an empty or unknown character as unsupported', () => {
		for (const char of ['', '€', '🙂']) {
			const guidance = guidanceFor(char);
			expect(guidance.supported).toBe(false);
			expect(guidance.hand).toBeNull();
			expect(guidance.finger).toBeNull();
			expect(guidance.keyId).toBe(char);
		}
	});

	it('supports every character used by every lesson', () => {
		for (const lesson of LESSONS) {
			expect(unsupportedCharacters(lesson.text), `lesson "${lesson.id}"`).toEqual([]);
		}
	});

	it('reports characters outside the printed board', () => {
		expect(unsupportedCharacters('abc')).toEqual([]);
		expect(unsupportedCharacters('café')).toEqual(['é']);
		expect(unsupportedCharacters('a\nb')).toEqual(['"\\n"']);
	});
});
