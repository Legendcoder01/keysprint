import { HOME_ROW_DRILLS, NUMBER_DRILLS, TEXTS } from './texts';
import type { DrillKind } from './drills';
import type { Difficulty } from './types';

export type { DrillKind } from './drills';
export { DRILL_LABELS } from './drills';

/**
 * Builds the practice text for a test.
 *
 * The result is a list of blocks plus the flat target string the user types.
 * A block is one visual line or paragraph; the target string joins the blocks
 * with a single space, because the line break is a layout device and the user
 * never types it.
 */

/** A request for practice text. */
export interface TextRequest {
	/** Test length in seconds. Drives how much text is generated. */
	durationSeconds: number;
	/** Which kind of material to draw from. */
	drill: DrillKind;
	/** Difficulty tier for the word, sentence and paragraph drills. */
	difficulty: Difficulty;
	/** Seed for reproducible text. Omit for a random selection. */
	seed?: number;
}

/**
 * Characters generated per second of test time.
 *
 * 20 characters per second is roughly 240 words per minute sustained for the
 * whole test, which leaves plenty of headroom for fast typists while keeping
 * the rendered document small.
 */
const CHARACTERS_PER_SECOND = 20;

/** Never generate less than this, so very short tests still have readable text. */
const MIN_CHARACTERS = 320;

/** Words per line in the "words" drill. */
const WORDS_PER_LINE = 12;

/** Deterministic pseudo random number generator (mulberry32). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const copy = items.slice();
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		const a = copy[i] as T;
		const b = copy[j] as T;
		copy[i] = b;
		copy[j] = a;
	}
	return copy;
}

/** The raw material available for a drill. */
function sourceFor(drill: DrillKind, difficulty: Difficulty): readonly string[] {
	switch (drill) {
		case 'numbers':
			return NUMBER_DRILLS;
		case 'punctuation':
			return TEXTS.punctuation;
		case 'paragraphs':
			return TEXTS.paragraphs;
		case 'homeRow':
			return HOME_ROW_DRILLS;
		case 'sentences':
			return TEXTS[difficulty];
		case 'words':
			return TEXTS[difficulty];
	}
}

/** Split a sentence bucket into short lines for the "words" drill. */
function toWordLines(sentences: readonly string[], random: () => number): string[] {
	const words = shuffle(sentences, random).join(' ').split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
		lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '));
	}
	return lines;
}

/** The material a drill cycles through, in the shape it is displayed. */
function blocksFor(request: TextRequest, random: () => number): string[] {
	const source = sourceFor(request.drill, request.difficulty);

	if (request.drill === 'words') {
		return toWordLines(source, random);
	}

	if (
		request.drill === 'sentences' ||
		request.drill === 'numbers' ||
		request.drill === 'punctuation' ||
		request.drill === 'homeRow'
	) {
		return shuffle(source, random);
	}

	// Paragraphs are long enough that shuffling alone looks odd; keep their
	// order but rotate the starting point so consecutive tests differ.
	const rotated = [...source.slice(2), ...source.slice(0, 2)];
	return rotated;
}

export interface BuiltText {
	/** Display blocks. Each one becomes a line or paragraph in the widget. */
	readonly blocks: readonly string[];
	/** The flat string the user actually types. */
	readonly text: string;
	/** Global index at which each block starts inside {@link text}. */
	readonly blockStarts: readonly number[];
}

/**
 * Build the practice text for a request.
 *
 * The corpus cycles when it runs out, reshuffled each time, so a ten minute
 * test never shows the same sentence order twice in a row.
 */
export function buildText(request: TextRequest): BuiltText {
	const random = mulberry32(request.seed ?? Math.floor(Math.random() * 0xffffffff));
	const budget = Math.max(MIN_CHARACTERS, Math.round(request.durationSeconds * CHARACTERS_PER_SECOND));

	const blocks: string[] = [];
	let characters = 0;
	let guard = 0;

	// Each pass reshuffles the source so repeated material does not appear in
	// the same order twice in a row.
	while (characters < budget && guard < 500) {
		guard += 1;
		for (const block of blocksFor(request, random)) {
			blocks.push(block);
			characters += block.length + 1;
			if (characters >= budget) break;
		}
	}

	const blockStarts: number[] = [];
	let cursor = 0;
	for (const block of blocks) {
		blockStarts.push(cursor);
		cursor += block.length + 1;
	}

	return {
		blocks,
		text: blocks.join(' '),
		blockStarts,
	};
}
