/**
 * The lesson completion rule.
 *
 * Kept apart from the curriculum data so the browser can evaluate a finished
 * drill without shipping the text of all ten lessons in the JavaScript bundle.
 */

/** How a drill ended. */
export type LessonOutcome = 'passed' | 'accuracy' | 'unfinished' | 'too-short';

/** The subset of a lesson the rule needs. */
export interface LessonRule {
	/** The exact text the learner types. */
	text: string;
	/** Seconds on the clock, or null for a sequence drill. */
	timedSeconds: number | null;
	/** Minimum character accuracy needed to pass, 0-100. */
	minAccuracy: number;
	/** Characters required in a timed drill before it can pass. */
	minCharacters: number;
}

/** The numbers a finished attempt reports. */
export interface LessonAttempt {
	/** Characters currently in the buffer, including wrong ones. */
	characters: number;
	/** Characters in the buffer that do not match. */
	errors: number;
	/** Character accuracy, 0-100. */
	accuracy: number;
	/** True when the clock reached zero. */
	endedByTime: boolean;
}

/**
 * Decide whether an attempt satisfies its lesson's completion rule.
 *
 * Sequence drill: the whole passage must be typed, and accuracy must reach the
 * lesson's threshold. Timed drill: the clock must have run out (or the whole
 * passage must be finished), at least `minCharacters` must be typed, and
 * accuracy must reach the threshold.
 */
export function evaluateLesson(lesson: LessonRule, attempt: LessonAttempt): LessonOutcome {
	if (!Number.isFinite(attempt.characters) || attempt.characters < 0) return 'unfinished';

	const typedAll = attempt.characters >= lesson.text.length;

	if (lesson.timedSeconds === null) {
		if (!typedAll) return 'unfinished';
		return attempt.accuracy >= lesson.minAccuracy ? 'passed' : 'accuracy';
	}

	if (!typedAll && !attempt.endedByTime) return 'unfinished';
	if (!typedAll && attempt.characters < lesson.minCharacters) return 'too-short';
	return attempt.accuracy >= lesson.minAccuracy ? 'passed' : 'accuracy';
}
