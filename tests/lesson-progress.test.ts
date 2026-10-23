import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LESSON_DRAFT_TTL_MS,
	clearLessonDraft,
	markLessonSkipped,
	markLessonStarted,
	parseLessonDraft,
	parseLessonRecords,
	readLessonDraft,
	readLessonRecord,
	readLessonRecords,
	recordLessonAttempt,
	writeLessonDraft,
} from '../src/lib/lesson-progress';

/**
 * Progress lives in localStorage, which means it can be missing, damaged or
 * hostile. The validators are tested directly; the storage-backed functions run
 * against an in-memory Storage so the behaviour on reload can be reproduced.
 */

class MemoryStorage {
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
		this.#data.set(key, String(value));
	}
}

let store: MemoryStorage;

beforeEach(() => {
	store = new MemoryStorage();
	vi.stubGlobal('window', { localStorage: store });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('parseLessonRecords', () => {
	it('returns an empty map for junk', () => {
		expect(parseLessonRecords(null)).toEqual({});
		expect(parseLessonRecords('nope')).toEqual({});
		expect(parseLessonRecords([])).toEqual({});
	});

	it('keeps valid records and drops damaged ones', () => {
		const parsed = parseLessonRecords({
			'happy-path': {
				status: 'completed',
				bestAccuracy: 98.5,
				bestWpm: 42,
				lastAttemptAt: '2026-02-01T10:00:00.000Z',
				completedAt: '2026-02-01T10:00:00.000Z',
			},
			started: {
				status: 'started',
				bestAccuracy: 80,
				bestWpm: 0,
				lastAttemptAt: '2026-02-02T10:00:00.000Z',
			},
			junk: 'not a record',
			'bad-status': { status: 'wat' },
			empty: {},
		});

		expect(parsed['happy-path']).toEqual({
			status: 'completed',
			bestAccuracy: 98.5,
			bestWpm: 42,
			lastAttemptAt: '2026-02-01T10:00:00.000Z',
			completedAt: '2026-02-01T10:00:00.000Z',
		});
		expect(parsed.started?.status).toBe('started');
		expect(parsed.started?.completedAt).toBeUndefined();
		expect(parsed.junk).toBeUndefined();
		expect(parsed['bad-status']).toBeUndefined();
		expect(parsed.empty).toBeUndefined();
	});

	it('clamps counters and fills a missing completion timestamp', () => {
		const parsed = parseLessonRecords({
			lesson: {
				status: 'completed',
				bestAccuracy: 140,
				bestWpm: -3,
				lastAttemptAt: '2026-02-01T10:00:00.000Z',
			},
		});

		const record = parsed.lesson;
		if (!record) throw new Error('record was dropped');
		expect(record.bestAccuracy).toBe(100);
		expect(record.bestWpm).toBe(0);
		expect(record.completedAt).toBe('2026-02-01T10:00:00.000Z');
	});
});

describe('parseLessonDraft', () => {
	it('rejects drafts that cannot be resumed', () => {
		expect(parseLessonDraft(null)).toBeNull();
		expect(parseLessonDraft({})).toBeNull();
		expect(parseLessonDraft({ lessonId: '', typed: 'abc', savedAt: 1 })).toBeNull();
		expect(parseLessonDraft({ lessonId: 'home-row', typed: '', savedAt: 1 })).toBeNull();
		expect(parseLessonDraft({ lessonId: 'home-row', typed: 'abc', savedAt: 0 })).toBeNull();
	});

	it('clamps the raw counters to the buffer', () => {
		const draft = parseLessonDraft({
			lessonId: 'home-row',
			typed: 'asdf',
			elapsedMs: -20,
			keystrokes: 1,
			correctKeystrokes: 99,
			savedAt: 5_000,
		});
		if (!draft) throw new Error('draft was dropped');
		expect(draft.elapsedMs).toBe(0);
		expect(draft.keystrokes).toBe(4);
		expect(draft.correctKeystrokes).toBe(4);
	});
});

describe('lesson records in storage', () => {
	it('starts a lesson once and keeps it started', () => {
		markLessonStarted('home-row');
		const first = readLessonRecord('home-row');
		expect(first?.status).toBe('started');
		expect(first?.bestAccuracy).toBe(0);

		markLessonStarted('home-row');
		expect(readLessonRecord('home-row')?.status).toBe('started');
	});

	it('records a pass, its accuracy and its completion time', () => {
		const at = new Date('2026-03-01T09:00:00.000Z');
		const record = recordLessonAttempt('home-row', { passed: true, accuracy: 97.5, wpm: 31 }, at);

		expect(record.status).toBe('completed');
		expect(record.bestAccuracy).toBe(97.5);
		expect(record.bestWpm).toBe(31);
		expect(record.completedAt).toBe(at.toISOString());
		expect(readLessonRecord('home-row')).toEqual(record);
	});

	it('keeps the best accuracy and speed without downgrading completion', () => {
		const first = new Date('2026-03-01T09:00:00.000Z');
		const second = new Date('2026-03-02T09:00:00.000Z');

		recordLessonAttempt('home-row', { passed: true, accuracy: 96, wpm: 20 }, first);
		const improved = recordLessonAttempt('home-row', { passed: true, accuracy: 99, wpm: 25 }, second);
		expect(improved.bestAccuracy).toBe(99);
		expect(improved.bestWpm).toBe(25);
		expect(improved.completedAt).toBe(first.toISOString());

		const weaker = recordLessonAttempt('home-row', { passed: false, accuracy: 70, wpm: 15 }, second);
		expect(weaker.status).toBe('completed');
		expect(weaker.bestAccuracy).toBe(99);
		expect(weaker.bestWpm).toBe(25);
		expect(weaker.completedAt).toBe(first.toISOString());
	});

	it('moves a failed attempt to started and a pass to completed', () => {
		const at = new Date('2026-03-01T09:00:00.000Z');
		recordLessonAttempt('home-row', { passed: false, accuracy: 88, wpm: 18 }, at);
		expect(readLessonRecord('home-row')?.status).toBe('started');

		recordLessonAttempt('home-row', { passed: true, accuracy: 96, wpm: 24 }, at);
		expect(readLessonRecord('home-row')?.status).toBe('completed');
	});

	it('does not let a skip downgrade a completed lesson', () => {
		recordLessonAttempt('home-row', { passed: true, accuracy: 97, wpm: 30 });
		markLessonSkipped('home-row');
		expect(readLessonRecord('home-row')?.status).toBe('completed');
	});

	it('moves a skipped lesson back to started after a failed run', () => {
		markLessonSkipped('home-row');
		expect(readLessonRecord('home-row')?.status).toBe('skipped');

		recordLessonAttempt('home-row', { passed: false, accuracy: 80, wpm: 12 });
		expect(readLessonRecord('home-row')?.status).toBe('started');
	});

	it('keeps lessons separate', () => {
		recordLessonAttempt('home-row', { passed: true, accuracy: 97, wpm: 30 });
		recordLessonAttempt('index-fingers', { passed: false, accuracy: 90, wpm: 25 });

		const records = readLessonRecords();
		expect(Object.keys(records).sort()).toEqual(['home-row', 'index-fingers']);
		expect(records['home-row']?.status).toBe('completed');
		expect(records['index-fingers']?.status).toBe('started');
	});
});

describe('lesson drafts', () => {
	const savedAt = 1_700_000_000_000;

	function draft(overrides: Partial<Parameters<typeof writeLessonDraft>[0]> = {}) {
		return {
			lessonId: 'home-row',
			typed: 'asdf',
			elapsedMs: 1_200,
			keystrokes: 5,
			correctKeystrokes: 4,
			savedAt,
			...overrides,
		};
	}

	it('round-trips a draft for the same lesson', () => {
		writeLessonDraft(draft());
		expect(readLessonDraft('home-row', savedAt + 1_000)).toEqual(draft());
	});

	it('does not return another lesson’s draft', () => {
		writeLessonDraft(draft());
		expect(readLessonDraft('index-fingers', savedAt)).toBeNull();
	});

	it('expires a draft after the TTL', () => {
		writeLessonDraft(draft());
		expect(readLessonDraft('home-row', savedAt + LESSON_DRAFT_TTL_MS)).not.toBeNull();
		expect(readLessonDraft('home-row', savedAt + LESSON_DRAFT_TTL_MS + 1)).toBeNull();
	});

	it('ignores an empty draft instead of storing it', () => {
		writeLessonDraft(draft({ typed: '' }));
		expect(readLessonDraft('home-row', savedAt)).toBeNull();
	});

	it('clears only the matching lesson’s draft', () => {
		writeLessonDraft(draft());
		clearLessonDraft('index-fingers');
		expect(readLessonDraft('home-row', savedAt)).not.toBeNull();

		clearLessonDraft('home-row');
		expect(readLessonDraft('home-row', savedAt)).toBeNull();
	});

	it('survives a storage that throws', () => {
		const hostile = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			},
		};
		vi.stubGlobal('window', { localStorage: hostile });

		expect(readLessonRecords()).toEqual({});
		expect(() => markLessonStarted('home-row')).not.toThrow();
		expect(() => recordLessonAttempt('home-row', { passed: false, accuracy: 80, wpm: 10 })).not.toThrow();
		expect(() => writeLessonDraft(draft())).not.toThrow();
		expect(() => clearLessonDraft('home-row')).not.toThrow();
	});
});
