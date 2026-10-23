/**
 * Lesson progress, kept on the visitor's device.
 *
 * keysprint has no accounts, so the lesson studio keeps two small records in
 * `localStorage`:
 *
 *   keysprint.lessons.v1        one record per lesson (status, best accuracy)
 *   keysprint.lesson-draft.v1   the attempt currently in progress
 *
 * The draft exists so a reload does not throw away a half-typed drill: the
 * player restores the buffer, the elapsed time and the raw keystroke counters.
 * A draft expires after {@link LESSON_DRAFT_TTL_MS}, because an attempt from
 * a month ago is not the same sitting.
 *
 * Everything here is defensive. Private browsing modes and blocked storage
 * throw on access, and a stored value may be damaged or from a future version;
 * none of that may stop the typing drill from working.
 */

const RECORDS_KEY = 'keysprint.lessons.v1';
const DRAFT_KEY = 'keysprint.lesson-draft.v1';

/** A draft older than this is ignored and replaced. */
export const LESSON_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How far a lesson has got. */
export type LessonStatus = 'started' | 'completed' | 'skipped';

export interface LessonRecord {
	status: LessonStatus;
	/** Best character accuracy seen, 0-100. */
	bestAccuracy: number;
	/** Best net WPM seen. Zero for sequence drills that have not finished. */
	bestWpm: number;
	/** ISO timestamp of the most recent attempt. */
	lastAttemptAt: string;
	/** ISO timestamp of the first passing attempt. */
	completedAt?: string;
}

/** Records keyed by lesson id. */
export type LessonRecords = Record<string, LessonRecord>;

/** A resumable attempt. */
export interface LessonDraft {
	lessonId: string;
	/** Characters typed and not deleted. */
	typed: string;
	/** Milliseconds already spent typing. */
	elapsedMs: number;
	/** Raw character input events, including deleted ones. */
	keystrokes: number;
	/** Input events where the character matched. */
	correctKeystrokes: number;
	/** When the draft was written, as a Unix timestamp. */
	savedAt: number;
}

function storage(): Storage | null {
	try {
		if (typeof window === 'undefined') return null;
		return window.localStorage;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isStatus(value: unknown): value is LessonStatus {
	return value === 'started' || value === 'completed' || value === 'skipped';
}

function isoOr(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Validate a stored record map without touching the DOM.
 *
 * Exported so the parser can be unit tested directly; damaged entries are
 * dropped rather than repaired into something that might be wrong.
 */
export function parseLessonRecords(raw: unknown): LessonRecords {
	if (!isRecord(raw)) return {};

	const records: LessonRecords = {};
	for (const [id, value] of Object.entries(raw)) {
		if (!id || !isRecord(value) || !isStatus(value.status)) continue;

		const record: LessonRecord = {
			status: value.status,
			bestAccuracy: clamp(finite(value.bestAccuracy), 0, 100),
			bestWpm: Math.max(0, finite(value.bestWpm)),
			lastAttemptAt: isoOr(value.lastAttemptAt, ''),
		};

		if (value.status === 'completed') {
			record.completedAt = isoOr(value.completedAt, record.lastAttemptAt);
		}

		records[id] = record;
	}

	return records;
}

/** Validate one stored draft without touching the DOM. */
export function parseLessonDraft(raw: unknown): LessonDraft | null {
	if (!isRecord(raw)) return null;
	if (typeof raw.lessonId !== 'string' || raw.lessonId.length === 0) return null;
	if (typeof raw.typed !== 'string' || raw.typed.length === 0) return null;

	const savedAt = finite(raw.savedAt, 0);
	if (savedAt <= 0) return null;

	const keystrokes = Math.max(raw.typed.length, Math.floor(finite(raw.keystrokes)));

	return {
		lessonId: raw.lessonId,
		typed: raw.typed,
		elapsedMs: Math.max(0, finite(raw.elapsedMs)),
		keystrokes,
		correctKeystrokes: clamp(Math.floor(finite(raw.correctKeystrokes)), 0, keystrokes),
		savedAt,
	};
}

/** Read every stored lesson record. */
export function readLessonRecords(): LessonRecords {
	const store = storage();
	if (!store) return {};
	try {
		const raw = store.getItem(RECORDS_KEY);
		if (!raw) return {};
		return parseLessonRecords(JSON.parse(raw));
	} catch {
		return {};
	}
}

/** Read one lesson record, or null when it has never been attempted. */
export function readLessonRecord(lessonId: string): LessonRecord | null {
	return readLessonRecords()[lessonId] ?? null;
}

function writeLessonRecords(records: LessonRecords): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(RECORDS_KEY, JSON.stringify(records));
	} catch {
		/* A blocked store must not break the lesson. */
	}
}

/**
 * Mark a lesson as begun.
 *
 * A completed lesson is never downgraded. A skipped lesson becomes "started"
 * again when the visitor returns to it.
 */
export function markLessonStarted(lessonId: string): void {
	const records = readLessonRecords();
	const existing = records[lessonId];
	// A completed lesson is never downgraded, but a fresh attempt still counts
	// as the most recent visit.
	if (existing?.status === 'completed') return;

	records[lessonId] = {
		status: 'started',
		bestAccuracy: existing?.bestAccuracy ?? 0,
		bestWpm: existing?.bestWpm ?? 0,
		lastAttemptAt: new Date().toISOString(),
	};
	writeLessonRecords(records);
}

export interface LessonAttemptRecord {
	/** True when the attempt met the lesson's completion rule. */
	passed: boolean;
	/** Character accuracy for this attempt, 0-100. */
	accuracy: number;
	/** Net WPM for this attempt. Zero when speed was not measured. */
	wpm: number;
}

/**
 * Store the result of a finished attempt.
 *
 * Best accuracy and best speed only ever improve. A completed lesson stays
 * completed even if a later attempt is weaker; a failed attempt on a skipped
 * lesson moves it back to "started".
 */
export function recordLessonAttempt(
	lessonId: string,
	attempt: LessonAttemptRecord,
	now: Date = new Date(),
): LessonRecord {
	const records = readLessonRecords();
	const existing = records[lessonId];
	const at = now.toISOString();
	const status: LessonStatus =
		attempt.passed || existing?.status === 'completed' ? 'completed' : 'started';

	const record: LessonRecord = {
		status,
		bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, clamp(finite(attempt.accuracy), 0, 100)),
		bestWpm: Math.max(existing?.bestWpm ?? 0, Math.max(0, finite(attempt.wpm))),
		lastAttemptAt: at,
	};

	const completedAt = existing?.completedAt ?? (attempt.passed ? at : undefined);
	if (completedAt) record.completedAt = completedAt;

	records[lessonId] = record;
	writeLessonRecords(records);
	return record;
}

/**
 * Mark a lesson as deliberately skipped.
 *
 * Skipping unlocks the next lesson, but it is recorded as skipped rather than
 * completed so the curriculum stays honest about what has been learned. A
 * lesson that was already passed stays completed.
 */
export function markLessonSkipped(lessonId: string, now: Date = new Date()): void {
	const records = readLessonRecords();
	const existing = records[lessonId];
	if (existing?.status === 'completed') return;

	records[lessonId] = {
		status: 'skipped',
		bestAccuracy: existing?.bestAccuracy ?? 0,
		bestWpm: existing?.bestWpm ?? 0,
		lastAttemptAt: now.toISOString(),
	};
	writeLessonRecords(records);
}

/** Save the attempt in progress, replacing any previous draft. */
export function writeLessonDraft(draft: LessonDraft): void {
	const store = storage();
	if (!store) return;
	if (!draft.lessonId || draft.typed.length === 0) return;

	const payload: LessonDraft = {
		lessonId: draft.lessonId,
		typed: draft.typed,
		elapsedMs: Math.max(0, finite(draft.elapsedMs)),
		keystrokes: Math.max(draft.typed.length, Math.floor(finite(draft.keystrokes))),
		correctKeystrokes: Math.max(0, Math.floor(finite(draft.correctKeystrokes))),
		savedAt: finite(draft.savedAt, Date.now()),
	};

	try {
		store.setItem(DRAFT_KEY, JSON.stringify(payload));
	} catch {
		/* A full store must not interrupt typing. */
	}
}

/**
 * Read the draft for one lesson.
 *
 * Returns null for another lesson's draft, a damaged draft, or one older than
 * {@link LESSON_DRAFT_TTL_MS}.
 */
export function readLessonDraft(lessonId: string, now: number = Date.now()): LessonDraft | null {
	const store = storage();
	if (!store) return null;

	try {
		const raw = store.getItem(DRAFT_KEY);
		if (!raw) return null;
		const draft = parseLessonDraft(JSON.parse(raw));
		if (!draft || draft.lessonId !== lessonId) return null;
		if (now - draft.savedAt > LESSON_DRAFT_TTL_MS) return null;
		return draft;
	} catch {
		return null;
	}
}

/**
 * Remove the draft for one lesson, leaving other lessons' records alone.
 *
 * Without an id the draft is always removed, and with an id it is removed
 * whenever it belongs to that lesson — including a draft old enough to have
 * expired, which must still be cleaned up.
 */
export function clearLessonDraft(lessonId?: string): void {
	const store = storage();
	if (!store) return;

	if (lessonId !== undefined) {
		try {
			const raw = store.getItem(DRAFT_KEY);
			if (raw) {
				const parsed: unknown = JSON.parse(raw);
				const owner = isRecord(parsed) ? parsed.lessonId : undefined;
				if (owner !== undefined && owner !== lessonId) return;
			}
		} catch {
			/* An unreadable draft is still worth removing. */
		}
	}

	try {
		store.removeItem(DRAFT_KEY);
	} catch {
		/* Nothing to do: the stale draft will expire. */
	}
}
