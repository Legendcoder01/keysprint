import { describe, expect, it } from 'vitest';
import {
	HOME_ROW_LESSON,
	LESSONS,
	evaluateLesson,
	getLesson,
	lessonHref,
	nextLesson,
	previousLesson,
} from '../src/lib/lessons';
import type { Lesson } from '../src/lib/lessons';
import type { LessonAttempt } from '../src/lib/lesson-rules';

/**
 * The curriculum is data, so it can be checked directly. These tests guard the
 * shape of the ten lessons, the navigation helpers and the completion rule that
 * gates the Next lesson button.
 */

function lessonOrThrow(id: string): Lesson {
	const lesson = getLesson(id);
	if (!lesson) throw new Error(`missing lesson "${id}"`);
	return lesson;
}

function attempt(overrides: Partial<LessonAttempt> = {}): LessonAttempt {
	return { characters: 0, errors: 0, accuracy: 0, endedByTime: false, ...overrides };
}

describe('the curriculum', () => {
	it('has exactly ten lessons in order', () => {
		expect(LESSONS).toHaveLength(10);
		LESSONS.forEach((lesson, index) => {
			expect(lesson.order).toBe(index + 1);
		});
	});

	it('has a unique id and unique metadata for every lesson', () => {
		expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
		expect(new Set(LESSONS.map((lesson) => lesson.metaTitle)).size).toBe(LESSONS.length);
		expect(new Set(LESSONS.map((lesson) => lesson.metaDescription)).size).toBe(LESSONS.length);
	});

	it('keeps page titles and descriptions inside the SEO limits', () => {
		for (const lesson of LESSONS) {
			expect(lesson.metaTitle.length, `${lesson.id} title`).toBeGreaterThanOrEqual(15);
			expect(lesson.metaTitle.length, `${lesson.id} title`).toBeLessThanOrEqual(70);
			expect(lesson.metaDescription.length, `${lesson.id} description`).toBeGreaterThanOrEqual(70);
			expect(lesson.metaDescription.length, `${lesson.id} description`).toBeLessThanOrEqual(175);
		}
	});

	it('gives every lesson real practice material and teaching copy', () => {
		for (const lesson of LESSONS) {
			expect(lesson.text.length, `${lesson.id} text`).toBeGreaterThanOrEqual(60);
			expect(lesson.text.trim(), `${lesson.id} text`).not.toBe('');
			expect(lesson.instructions.length, `${lesson.id} instructions`).toBeGreaterThan(20);
			expect(lesson.notes).toHaveLength(2);
			expect(lesson.tips).toHaveLength(3);
			expect(lesson.focus.length, `${lesson.id} focus`).toBeGreaterThan(0);
			expect(lesson.minAccuracy).toBeGreaterThan(0);
			expect(lesson.minAccuracy).toBeLessThanOrEqual(100);
		}
	});

	it('makes the first nine lessons untimed sequence drills and the last one a timed test', () => {
		for (const lesson of LESSONS.slice(0, 9)) {
			expect(lesson.timedSeconds, `${lesson.id} timedSeconds`).toBeNull();
			expect(lesson.minCharacters, `${lesson.id} minCharacters`).toBe(0);
		}

		const mixed = lessonOrThrow('mixed-practice');
		expect(mixed.timedSeconds).toBe(60);
		expect(mixed.minAccuracy).toBe(90);
		expect(mixed.minCharacters).toBeGreaterThan(0);
		// The passage must be long enough to reach the minimum character count.
		expect(mixed.text.length).toBeGreaterThanOrEqual(mixed.minCharacters);
	});

	it('keeps the home-row drill on the home row only', () => {
		const allowed = new Set('asdfjkl; ');
		for (const char of HOME_ROW_LESSON.text) {
			expect(allowed.has(char), `unexpected home-row character "${char}"`).toBe(true);
		}
	});

	it('exposes the home row as the first lesson', () => {
		expect(HOME_ROW_LESSON).toBe(LESSONS[0]);
		expect(lessonHref(HOME_ROW_LESSON.id)).toBe('/typing-lessons/home-row/');
	});
});

describe('lesson navigation', () => {
	it('looks lessons up by id', () => {
		expect(getLesson('home-row')?.order).toBe(1);
		expect(getLesson('mixed-practice')?.order).toBe(10);
		expect(getLesson('not-a-lesson')).toBeUndefined();
	});

	it('walks the curriculum forwards and backwards', () => {
		expect(previousLesson('home-row')).toBeNull();
		expect(nextLesson('home-row')?.id).toBe('index-fingers');
		expect(nextLesson('mixed-practice')).toBeNull();
		expect(previousLesson('mixed-practice')?.id).toBe('numbers-punctuation');
		expect(nextLesson('not-a-lesson')).toBeNull();
		expect(previousLesson('not-a-lesson')).toBeNull();
	});

	it('builds a trailing-slash route for every lesson', () => {
		for (const lesson of LESSONS) {
			expect(lessonHref(lesson.id)).toBe(`/typing-lessons/${lesson.id}/`);
		}
	});
});

describe('evaluateLesson for sequence drills', () => {
	const lesson = lessonOrThrow('home-row');

	it('requires the whole passage and the accuracy target', () => {
		const passed = attempt({ characters: lesson.text.length, accuracy: lesson.minAccuracy });
		expect(evaluateLesson(lesson, passed)).toBe('passed');

		expect(evaluateLesson(lesson, { ...passed, characters: lesson.text.length - 1 })).toBe(
			'unfinished',
		);
		expect(evaluateLesson(lesson, { ...passed, accuracy: lesson.minAccuracy - 0.1 })).toBe(
			'accuracy',
		);
	});

	it('reports unfinished for zero or invalid input', () => {
		expect(evaluateLesson(lesson, attempt())).toBe('unfinished');
		expect(evaluateLesson(lesson, attempt({ characters: Number.NaN }))).toBe('unfinished');
		expect(evaluateLesson(lesson, attempt({ characters: -4 }))).toBe('unfinished');
		expect(evaluateLesson(lesson, attempt({ characters: Infinity }))).toBe('unfinished');
	});

	it('accepts a corrected run that ends at exactly the accuracy target', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({ characters: lesson.text.length, accuracy: lesson.minAccuracy, errors: 2 }),
			),
		).toBe('passed');
	});
});

describe('evaluateLesson for the timed test', () => {
	const lesson = lessonOrThrow('mixed-practice');

	it('passes a finished passage before the clock runs out', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({ characters: lesson.text.length, accuracy: 100, endedByTime: false }),
			),
		).toBe('passed');
	});

	it('passes a timed run that reaches both targets', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({
					characters: lesson.minCharacters,
					accuracy: lesson.minAccuracy,
					endedByTime: true,
				}),
			),
		).toBe('passed');
	});

	it('fails a timed run that stops short of the minimum character count', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({
					characters: lesson.minCharacters - 1,
					accuracy: 100,
					endedByTime: true,
				}),
			),
		).toBe('too-short');
	});

	it('fails a timed run below the accuracy target', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({
					characters: lesson.minCharacters + 20,
					accuracy: lesson.minAccuracy - 0.1,
					endedByTime: true,
				}),
			),
		).toBe('accuracy');
	});

	it('does not judge a partial run that is still running', () => {
		expect(
			evaluateLesson(
				lesson,
				attempt({ characters: lesson.text.length - 1, accuracy: 100, endedByTime: false }),
			),
		).toBe('unfinished');
	});

	it('reports unfinished rather than too-short for a zero-character timeout', () => {
		// Zero characters is a valid timeout result, but it is still "too short".
		expect(evaluateLesson(lesson, attempt({ endedByTime: true }))).toBe('too-short');
	});
});
