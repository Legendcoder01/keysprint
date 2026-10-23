import { describe, expect, it } from 'vitest';
import { buildText } from '../src/lib/typing/selection';
import { HOME_ROW_DRILLS, TEXTS } from '../src/lib/typing/texts';

describe('buildText', () => {
	it('generates at least the requested character budget', () => {
		const result = buildText({
			durationSeconds: 60,
			drill: 'sentences',
			difficulty: 'easy',
			seed: 42,
		});
		expect(result.text.length).toBeGreaterThanOrEqual(1_000);
		expect(result.blocks.length).toBeGreaterThan(0);
	});

	it('joins blocks with a single space so the user never types a line break', () => {
		const result = buildText({
			durationSeconds: 15,
			drill: 'sentences',
			difficulty: 'easy',
			seed: 7,
		});
		expect(result.text).toBe(result.blocks.join(' '));
		expect(result.text).not.toContain('\n');
	});

	it('records where each block starts inside the flat text', () => {
		const result = buildText({
			durationSeconds: 15,
			drill: 'sentences',
			difficulty: 'easy',
			seed: 11,
		});

		let expected = 0;
		for (let i = 0; i < result.blocks.length; i += 1) {
			expect(result.blockStarts[i]).toBe(expected);
			const block = result.blocks[i] as string;
			expect(result.text.slice(expected, expected + block.length)).toBe(block);
			expected += block.length + 1;
		}
	});

	it('is reproducible for a given seed', () => {
		const request = {
			durationSeconds: 30,
			drill: 'paragraphs' as const,
			difficulty: 'medium' as const,
			seed: 1234,
		};
		const first = buildText(request);
		const second = buildText(request);
		expect(first.text).toBe(second.text);
	});

	it('produces different text for different seeds', () => {
		const base = { durationSeconds: 30, drill: 'sentences' as const, difficulty: 'easy' as const };
		const first = buildText({ ...base, seed: 1 });
		const second = buildText({ ...base, seed: 2 });
		expect(first.text).not.toBe(second.text);
	});

	it('cycles the corpus without running out of text on a long test', () => {
		const result = buildText({
			durationSeconds: 600,
			drill: 'sentences',
			difficulty: 'easy',
			seed: 3,
		});
		expect(result.text.length).toBeGreaterThanOrEqual(10_000);
	});

	it('wraps the words drill into short lines', () => {
		const result = buildText({
			durationSeconds: 60,
			drill: 'words',
			difficulty: 'easy',
			seed: 5,
		});
		for (const block of result.blocks) {
			expect(block.split(' ').length).toBeLessThanOrEqual(12);
		}
	});

	it('uses the number and punctuation material for those drills', () => {
		const numbers = buildText({
			durationSeconds: 30,
			drill: 'numbers',
			difficulty: 'easy',
			seed: 9,
		});
		expect(numbers.text).toMatch(/\d/);

		const punctuation = buildText({
			durationSeconds: 30,
			drill: 'punctuation',
			difficulty: 'easy',
			seed: 9,
		});
		expect(punctuation.text).toMatch(/["“]/);
	});

	it('never emits an empty block', () => {
		for (const drill of ['words', 'sentences', 'paragraphs', 'numbers', 'punctuation', 'homeRow'] as const) {
			const result = buildText({
				durationSeconds: 30,
				drill,
				difficulty: 'hard',
				seed: 17,
			});
			for (const block of result.blocks) {
				expect(block.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it('keeps every home row character on the home row', () => {
		const result = buildText({
			durationSeconds: 60,
			drill: 'homeRow',
			difficulty: 'easy',
			seed: 21,
		});

		// a s d f j k l and the semicolon, plus the space bar.
		expect(result.text).toMatch(/^[asdfjkl; ]+$/);
		expect(result.blocks.length).toBeGreaterThan(0);
	});

	it('ships an original corpus with enough material in every bucket', () => {
		expect(TEXTS.easy.length).toBeGreaterThanOrEqual(30);
		expect(TEXTS.medium.length).toBeGreaterThanOrEqual(25);
		expect(TEXTS.hard.length).toBeGreaterThanOrEqual(15);
		expect(TEXTS.paragraphs.length).toBeGreaterThanOrEqual(10);
		expect(TEXTS.punctuation.length).toBeGreaterThanOrEqual(12);
		expect(HOME_ROW_DRILLS.length).toBeGreaterThanOrEqual(15);
	});

	it('keeps every home row drill entry inside the home row', () => {
		for (const drill of HOME_ROW_DRILLS) {
			expect(drill).toMatch(/^[asdfjkl; ]+$/);
		}
	});
});
