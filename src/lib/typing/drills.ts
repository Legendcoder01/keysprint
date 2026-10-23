import type { TestMode } from './types';

/**
 * The drill kinds and their display names.
 *
 * This lives on its own, away from `selection.ts`, so a page that only needs
 * to label a stored test does not pull the whole practice corpus into its
 * bundle along with it.
 */

/** Every kind of material a test can draw from. */
export type DrillKind = TestMode | 'numbers' | 'punctuation' | 'homeRow';

/** Human readable name for every drill kind. */
export const DRILL_LABELS: Record<DrillKind, string> = {
	words: 'words',
	sentences: 'sentences',
	paragraphs: 'paragraphs',
	numbers: 'numbers',
	punctuation: 'punctuation',
	homeRow: 'home row',
};
