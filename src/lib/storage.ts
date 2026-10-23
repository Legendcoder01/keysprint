/**
 * Local storage helpers.
 *
 * keysprint has no accounts and no server, so the only things worth keeping
 * are the visitor's own best scores, their recent results and their theme
 * choice. Everything is stored under versioned keys so a future format change
 * can never read a stale value.
 *
 * Every function is defensive: private browsing modes and blocked storage
 * throw on access, and a typing test must keep working when they do.
 */

import type { KeyTallies } from './typing/types';

const BEST_SCORES_KEY = 'keysprint.best.v1';

const HISTORY_KEY = 'keysprint.history.v1';

/** Key used to persist the light or dark theme choice. */
export const THEME_STORAGE_KEY = 'keysprint.theme';

/** How many finished tests are kept for the local analysis. */
export const MAX_HISTORY = 20;

/** Best net WPM per test configuration, keyed by {@link bestScoreKey}. */
export type BestScores = Record<string, number>;

/**
 * One finished test, kept so the breakdown can be built from real data.
 *
 * The entry holds the headline numbers of the test and the per-character
 * keystroke tallies. Nothing is uploaded: this never leaves the browser.
 */
export interface HistoryEntry {
	/** When the test finished, as an ISO timestamp. */
	at: string;
	/** Length of the test in seconds. */
	durationSeconds: number;
	/** Which drill the test used. */
	drill: string;
	/** Net words per minute. */
	netWpm: number;
	/** Words per minute before errors were removed. */
	grossWpm: number;
	/** Character accuracy, from 0 to 100. */
	charAccuracy: number;
	/** Keystroke accuracy, from 0 to 100. */
	keystrokeAccuracy: number;
	/** Errors left in the buffer. */
	errors: number;
	/** Characters in the buffer. */
	characters: number;
	/** Words in the buffer. */
	words: number;
	/** Length of the test in milliseconds. */
	elapsedMs: number;
	/** Per-character keystroke tallies. */
	tallies: KeyTallies;
}

function storage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

/** Read every stored best score. Returns an empty map on any failure. */
export function readBestScores(): BestScores {
	const store = storage();
	if (!store) return {};
	try {
		const raw = store.getItem(BEST_SCORES_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return {};

		const scores: BestScores = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof value === 'number' && Number.isFinite(value)) scores[key] = value;
		}
		return scores;
	} catch {
		return {};
	}
}

/** The best net WPM stored for a configuration, or `null` when there is none. */
export function readBestScore(key: string): number | null {
	const value = readBestScores()[key];
	return typeof value === 'number' ? value : null;
}

/**
 * Store a new best score.
 *
 * Returns `true` when the stored value improved, so the caller can tell the
 * visitor that they set a record.
 */
export function writeBestScore(key: string, value: number): boolean {
	if (!Number.isFinite(value) || value <= 0) return false;

	const store = storage();
	if (!store) return false;

	const scores = readBestScores();
	const previous = scores[key];
	if (typeof previous === 'number' && previous >= value) return false;

	scores[key] = Math.round(value * 10) / 10;
	try {
		store.setItem(BEST_SCORES_KEY, JSON.stringify(scores));
		return true;
	} catch {
		return false;
	}
}

/**
 * Build the key a best score is stored under.
 *
 * The duration and the drill both matter: a fast sentence test and a fast
 * number test are not comparable.
 */
export function bestScoreKey(durationSeconds: number, drill: string): string {
	return `${durationSeconds}-${drill}`;
}

/* -------------------------------------------------------------------------
   The local result history
   ------------------------------------------------------------------------- */

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** Read the per-character tallies of a stored entry, ignoring anything odd. */
function readTallies(value: unknown): KeyTallies {
	if (typeof value !== 'object' || value === null) return {};

	const tallies: KeyTallies = {};
	for (const [char, tally] of Object.entries(value as Record<string, unknown>)) {
		if (typeof tally !== 'object' || tally === null) continue;
		const record = tally as Record<string, unknown>;
		if (!isFiniteNumber(record.pressed) || !isFiniteNumber(record.correct) || !isFiniteNumber(record.missed)) {
			continue;
		}
		tallies[char] = {
			pressed: Math.max(0, record.pressed),
			correct: Math.max(0, record.correct),
			missed: Math.max(0, record.missed),
		};
	}
	return tallies;
}

/**
 * Read the stored history, newest first.
 *
 * Entries that are damaged or were written by a future version are skipped
 * rather than allowed to break the page.
 */
export function readHistory(): HistoryEntry[] {
	const store = storage();
	if (!store) return [];

	try {
		const raw = store.getItem(HISTORY_KEY);
		if (!raw) return [];

		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		const entries: HistoryEntry[] = [];
		for (const item of parsed) {
			if (typeof item !== 'object' || item === null) continue;
			const record = item as Record<string, unknown>;
			if (!isFiniteNumber(record.netWpm)) continue;

			entries.push({
				at: typeof record.at === 'string' ? record.at : '',
				durationSeconds: isFiniteNumber(record.durationSeconds) ? record.durationSeconds : 0,
				drill: typeof record.drill === 'string' ? record.drill : 'words',
				netWpm: record.netWpm,
				grossWpm: isFiniteNumber(record.grossWpm) ? record.grossWpm : 0,
				charAccuracy: isFiniteNumber(record.charAccuracy) ? record.charAccuracy : 0,
				keystrokeAccuracy: isFiniteNumber(record.keystrokeAccuracy) ? record.keystrokeAccuracy : 0,
				errors: isFiniteNumber(record.errors) ? record.errors : 0,
				characters: isFiniteNumber(record.characters) ? record.characters : 0,
				words: isFiniteNumber(record.words) ? record.words : 0,
				elapsedMs: isFiniteNumber(record.elapsedMs) ? record.elapsedMs : 0,
				tallies: readTallies(record.tallies),
			});
		}
		return entries;
	} catch {
		return [];
	}
}

/**
 * Add a finished test to the history.
 *
 * The newest test is kept at the front and only the most recent
 * {@link MAX_HISTORY} tests are kept at all, so the stored data stays small.
 */
export function writeHistoryEntry(entry: HistoryEntry): void {
	const store = storage();
	if (!store) return;

	const history = [entry, ...readHistory()].slice(0, MAX_HISTORY);
	try {
		store.setItem(HISTORY_KEY, JSON.stringify(history));
	} catch {
		/* A blocked or full store must not break the test that just finished. */
	}
}

/** Remove every stored result. The best scores and the theme are kept. */
export function clearHistory(): void {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(HISTORY_KEY);
	} catch {
		/* Nothing to do: the data stays where it was. */
	}
}
