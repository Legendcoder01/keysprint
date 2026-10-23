/**
 * The touch typing curriculum.
 *
 * Ten lessons, in the order they are meant to be learned. Each one has its own
 * practice sequence, its own instructions, its own accuracy target and its own
 * completion rule. The lesson player and the lesson index both read this file,
 * so there is exactly one definition of the curriculum.
 *
 * Beginner lessons are sequence drills: the lesson is complete when the whole
 * sequence has been typed. WPM is deliberately not shown during those drills,
 * because a short sequence is not a speed measurement. The final lesson is a
 * 60-second paragraph test with live WPM.
 */

export interface Lesson {
	/** URL slug and storage key. */
	id: string;
	/** Position in the curriculum, starting at 1. */
	order: number;
	/** Visible lesson title. */
	title: string;
	/** Unique page title. */
	metaTitle: string;
	/** Unique meta description. */
	metaDescription: string;
	/** Intro shown in the page hero. */
	lead: string;
	/** Short instructions shown above the passage. */
	instructions: string;
	/** Human-readable list of the keys the lesson focuses on. */
	focus: string;
	/** The exact text the learner types. */
	text: string;
	/** Minimum character accuracy needed to pass, 0-100. */
	minAccuracy: number;
	/** Seconds on the clock, or null for a sequence drill. */
	timedSeconds: number | null;
	/** Characters that must be typed in a timed lesson before it can pass. */
	minCharacters: number;
	/** Two paragraphs of teaching material for the lesson page. */
	notes: readonly [string, string];
	/** Three short practice tips. */
	tips: readonly [string, string, string];
}

export const LESSONS: readonly Lesson[] = [
	{
		id: 'home-row',
		order: 1,
		title: 'The home row',
		metaTitle: 'Home Row Typing Lesson — Learn a s d f j k l ;',
		metaDescription:
			'A focused touch typing lesson for the home row: the finger assignment for a s d f j k l and the space bar, plus a live home row drill to practise in.',
		lead:
			'Eight keys, eight fingers, and one position that everything else is measured from. This drill uses nothing but the home row, so you can build the position without anything else getting in the way.',
		instructions:
			'Type the line with the home-row keys only. Rest your fingers on a s d f and j k l ;, watch the keyboard guide, and return each finger home after every reach.',
		focus: 'a s d f · j k l ;',
		text: 'asdf jkl; asdf jkl; sad lad dad fad ask all fall flask salad lass alas; a lad asks; dad adds all; fall lads; a salad',
		minAccuracy: 96,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The home row is the only position your hands return to after every reach. The eight keys here — a s d f on the left, j k l ; on the right — are the reference points for the entire board.',
			'Type this drill slowly enough that each key is pressed by the finger named in the guide. When the line is clean, the position is working; speed comes later.',
		],
		tips: [
			'Find the raised bumps on F and J without looking.',
			'Keep your wrists off the desk and your fingers slightly curved.',
			'Aim for 96% accuracy before you move on.',
		],
	},
	{
		id: 'index-fingers',
		order: 2,
		title: 'Index fingers',
		metaTitle: 'Index Finger Typing Lesson — f g r t v b, j h u y n m',
		metaDescription:
			'Practise the index-finger keys f g r t v b and j h u y n m in a guided touch typing drill with a virtual keyboard and finger guide.',
		lead:
			'The index fingers cover the middle columns of the keyboard. This drill concentrates on f g r t v b and j h u y n m, with the next key and the finger that owns it highlighted as you type.',
		instructions:
			'Type the line using the index fingers. Keep the other fingers resting on their home keys and return to F and J after each reach.',
		focus: 'f g r t v b · j h u y n m',
		text: 'gym hymn fury jury turn burn bunny myth hunt grunt hut gut rut mutt guru rug hum gum mug bun run fun nut but tug grub brunt truth thug hug turf rhythm',
		minAccuracy: 95,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The index fingers cover the widest column on each hand: f g r t v b on the left, j h u y n m on the right. Every one of those reaches starts and ends on F or J.',
			'This drill uses only index-finger keys, so any hesitation in the line is a reach to fix rather than a new key to learn.',
		],
		tips: [
			'Move the whole finger, not the wrist, for vertical reaches.',
			'Return to F or J after every key.',
			'If a word goes wrong, backspace and retype it.',
		],
	},
	{
		id: 'middle-fingers',
		order: 3,
		title: 'Middle fingers',
		metaTitle: 'Middle Finger Typing Lesson — d e c and k i ,',
		metaDescription:
			'A short middle-finger drill for d e c and k i. See the next key, the finger that presses it, and your live accuracy as you type.',
		lead:
			'The middle fingers move straight up and down from the home row. This drill isolates d e c, k i and the comma so the movement becomes automatic.',
		instructions:
			'Type the line with the middle fingers. Keep the wrists still and let the finger move alone.',
		focus: 'd e c · k i ,',
		text: 'ice, dice, decide, deck, kid, did, cede, deed, die, iced, decide, deck, kid, ice, dice',
		minAccuracy: 95,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The middle fingers travel straight up and down: d, e and c on the left; k, i and comma on the right. Because the movement is short, these keys are usually the easiest to make automatic.',
			'Keep the other fingers anchored while the middle finger reaches; the drill is as much about stillness as it is about the keys.',
		],
		tips: [
			'Curl the middle finger rather than flattening the hand.',
			'Do not let the wrist drift towards the key.',
			'Watch the finger guide, not your hands.',
		],
	},
	{
		id: 'ring-fingers',
		order: 4,
		title: 'Ring fingers',
		metaTitle: 'Ring Finger Typing Lesson — s w x and l o .',
		metaDescription:
			'Train the ring fingers on s w x and l o. A guided touch typing drill with an on-screen keyboard, hand guide and accuracy target.',
		lead:
			'The ring fingers are the least independent fingers, which makes s w x, l o and the full stop worth practising on their own.',
		instructions:
			'Type the line with the ring fingers. Slow down enough that the correct finger does the work.',
		focus: 's w x · l o .',
		text: 'slow solo loss low owl sow lows wool slows so ox slow solo loss owl low slow solo loss low owl sow',
		minAccuracy: 94,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The ring fingers are the least independent fingers on the hand, which is why s, w, x, l, o and the full stop need deliberate practice. They also share their column with the little fingers, so the reach is easy to shortcut.',
			'Keep the little finger relaxed and let the ring finger do its own work.',
		],
		tips: [
			'Type slowly enough that the ring finger moves alone.',
			'Keep the palm still.',
			'Repeat the drill until the reaches feel boring.',
		],
	},
	{
		id: 'little-fingers',
		order: 5,
		title: 'Little fingers',
		metaTitle: 'Little Finger Typing Lesson — a q z and ; p /',
		metaDescription:
			'Practise the little-finger keys a q z, the semicolon, p and slash with a virtual keyboard and a live finger guide. No sign-up needed.',
		lead:
			'The little fingers own the outer edge of the keyboard, including Shift and the semicolon. This short drill gives them the work they usually avoid.',
		instructions:
			'Type the line with the little fingers. Keep the hand relaxed, use the fingertip, and take the Shift only when the guide asks for it.',
		focus: 'a q z · ; p /',
		text: 'papa zap app quip quiz quit pizza plaza quail pal lap sap; a zap; papa; quiz; a pal; plaza',
		minAccuracy: 94,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The little fingers take the outside edge of the board — a, q and z on the left; semicolon, p and slash on the right — and they are also the fingers that hold Shift. That makes them disproportionately important.',
			'The drill includes the semicolon deliberately: it is the most-missed home-row key.',
		],
		tips: [
			'Use the tip of the little finger, not the side.',
			'Let the hand stay quiet while the finger reaches.',
			'Do not twist the wrist to reach P.',
		],
	},
	{
		id: 'upper-row',
		order: 6,
		title: 'Upper row',
		metaTitle: 'Upper Row Typing Lesson — q w e r t y u i o p',
		metaDescription:
			'Type the upper letter row without looking. A guided q w e r t y u i o p drill with the next-key highlight and a finger-by-finger hand guide.',
		lead:
			'One row up from home. This drill covers q w e r t y u i o p, returning to the home row after every reach.',
		instructions:
			'Type the upper-row drill. Reach with one finger, return to the home row, then type the next character.',
		focus: 'q w e r t y u i o p',
		text: 'quiet write type your tree tower power report pretty; we type; you write; a quiet row',
		minAccuracy: 93,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The upper row is one key away from home, but it is the row beginners most often reach for with the wrong finger. Letters are grouped by the finger that owns the column, not by how easy the reach feels.',
			'Every reach in this drill leaves the home row, so the return is part of the exercise.',
		],
		tips: [
			'Reach with one finger and keep the others down.',
			'Return to the home key before the next letter.',
			'Look at the guide rather than the keyboard.',
		],
	},
	{
		id: 'lower-row',
		order: 7,
		title: 'Lower row',
		metaTitle: 'Lower Row Typing Lesson — z x c v b n m and , . /',
		metaDescription:
			'A guided lower-row drill for z x c v b n m and the comma, full stop and slash, with a virtual keyboard and live accuracy tracking.',
		lead:
			'One row down from home. This drill covers z x c v b n m and the comma, full stop and slash, with the hand anchored on the home row.',
		instructions:
			'Type the lower-row drill. Curl the fingers under the hand and keep the palm still.',
		focus: 'z x c v b n m · , . /',
		text: 'zebra buzz vex mix cave numb move; a brave zebra; come back; mix it up; move over; a cave',
		minAccuracy: 93,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The lower row sits under the home row: z x c v b on the left, n m and the punctuation on the right. The fingers have to curl rather than stretch, which is why the row feels awkward at first.',
			'Keep the knuckles up and press with the fingertips. The drill deliberately mixes the row with vowels so the hand has to return to position.',
		],
		tips: [
			'Do not let the palm collapse onto the desk.',
			'Curl the finger; do not bend the wrist.',
			'Take a short break if your forearms tighten.',
		],
	},
	{
		id: 'capitals-shift',
		order: 8,
		title: 'Capitals and Shift',
		metaTitle: 'Capital Letters and Shift — Typing Lesson 8',
		metaDescription:
			'Learn to hold Shift with the opposite hand while typing capital letters. A guided sentence drill with a live hand and virtual keyboard guide.',
		lead:
			'Capitals are a two-hand action: Shift with one little finger, the letter with the other hand. This drill practises the pairing in ordinary sentences.',
		instructions:
			'Type the sentences, holding Shift with the hand opposite each capital. Release Shift as soon as the letter is typed.',
		focus: 'Shift + letters',
		text: 'Alice and Bob met in Paris. They read a book with Mia and Noah. I saw them on Monday; the train to London was late.',
		minAccuracy: 92,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'Capitals are made with Shift, and the Shift key belongs to the hand opposite the letter. Right hand on the letter, left little finger on Shift; left hand on the letter, right little finger on Shift.',
			'The drill is ordinary prose with proper nouns, so Shift appears where it does in real writing rather than in isolation.',
		],
		tips: [
			'Press Shift just before the letter and release it immediately.',
			'Keep the typing hand on its home key while Shift is held.',
			'Never reach across the board for the other Shift.',
		],
	},
	{
		id: 'numbers-punctuation',
		order: 9,
		title: 'Numbers and punctuation',
		metaTitle: 'Numbers and Punctuation — Typing Lesson 9',
		metaDescription:
			'Practise digits and shifted symbols on the number row. A guided numbers and punctuation drill with a virtual keyboard and accuracy target.',
		lead:
			'Digits, times, money and brackets. This drill puts the number row and its shifted symbols into realistic short passages.',
		instructions:
			'Type the numbers and symbols. Use the finger for the digit and the opposite-hand Shift for each symbol.',
		focus: '1–0 · ! @ # $ % & * ( ) ?',
		text: 'Order 12 boxes by 3:45 p.m. Call 555-0134; pay $48.50 (20% off). Use code A7-2B?',
		minAccuracy: 90,
		timedSeconds: null,
		minCharacters: 0,
		notes: [
			'The number row is the top row of the board, and each digit belongs to the same finger column as the letter below it. The shifted symbol above a digit is typed with the same finger plus the opposite-hand Shift.',
			'This drill is a short, realistic block of numbers, times, money and brackets. Accuracy matters more than speed here because a wrong digit is rarely obvious from context.',
		],
		tips: [
			'Return to the home row after every number.',
			'Use the Shift hand opposite the digit.',
			'Say the number to yourself as you type it.',
		],
	},
	{
		id: 'mixed-practice',
		order: 10,
		title: 'Mixed practice',
		metaTitle: 'Mixed Practice Typing Lesson — 60-Second Paragraph',
		metaDescription:
			'Put every key together in a 60-second paragraph drill. Live words per minute, accuracy and a progress panel, with pause and resume built in.',
		lead:
			'Every key, one paragraph, sixty seconds. The final lesson mixes letters, capitals and punctuation and measures live words per minute alongside accuracy.',
		instructions:
			'Type the paragraph for 60 seconds. You need 90% accuracy and at least 120 characters to pass. Pause any time; the pause is not counted.',
		focus: 'all keys · 60 seconds',
		text: 'A good typing habit is quiet and steady. Keep your hands on the home row, eyes on the words, and let each finger reach only as far as it must. Speed is a result, not a target: accuracy first, then a little more pace each day. When a word goes wrong, fix it once and move on. The rhythm you build in a short daily session will stay with you far longer than one long, rushed attempt.',
		minAccuracy: 90,
		timedSeconds: 60,
		minCharacters: 120,
		notes: [
			'The final drill puts everything together in a 60-second paragraph. The clock is the limit, but accuracy is the target: the lesson passes at 90% accuracy with at least 120 characters typed.',
			'You can pause at any time. Paused time is excluded from the clock and from the speed calculation, and the text you have typed stays exactly where it was.',
		],
		tips: [
			'Read one word ahead of your fingers.',
			'Fix a mistake once, then move on.',
			'Pause rather than rushing when the timer starts to pressure you.',
		],
	},
] as const;

/** The lesson that appears on the existing home-row route. */
export const HOME_ROW_LESSON: Lesson = LESSONS[0] as Lesson;

/** Look a lesson up by slug. */
export function getLesson(id: string): Lesson | undefined {
	return LESSONS.find((lesson) => lesson.id === id);
}

/** The lesson after this one, or null at the end of the curriculum. */
export function nextLesson(id: string): Lesson | null {
	const index = LESSONS.findIndex((lesson) => lesson.id === id);
	if (index < 0) return null;
	return LESSONS[index + 1] ?? null;
}

/** The lesson before this one, or null at the start. */
export function previousLesson(id: string): Lesson | null {
	const index = LESSONS.findIndex((lesson) => lesson.id === id);
	if (index <= 0) return null;
	return LESSONS[index - 1] ?? null;
}

/** Where a lesson lives. */
export function lessonHref(id: string): string {
	return `/typing-lessons/${id}/`;
}

/*
 * The completion rule lives in `lesson-rules.ts` so the browser can evaluate
 * an attempt without bundling the text of every lesson. It is re-exported here
 * because this module is the natural place to look for it.
 */
export { evaluateLesson } from './lesson-rules';
export type { LessonAttempt, LessonOutcome, LessonRule } from './lesson-rules';
