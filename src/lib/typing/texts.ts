/**
 * The practice text collection.
 *
 * Every passage in this file was written for keysprint. Nothing here is
 * scraped, quoted or adapted from a third party, so the site can ship it
 * without attribution obligations.
 *
 * The corpus is organised by difficulty. Each bucket is deliberately plain
 * writing: it exercises the keyboard rather than the reader.
 */

export interface TextBucket {
	/** Short sentences for beginners. */
	readonly easy: readonly string[];
	/** Medium-length sentences with a little more punctuation. */
	readonly medium: readonly string[];
	/** Longer sentences, more commas, more varied vocabulary. */
	readonly hard: readonly string[];
	/** Multi-sentence paragraphs for sustained reading. */
	readonly paragraphs: readonly string[];
	/** Sentences loaded with punctuation marks. */
	readonly punctuation: readonly string[];
}

export const TEXTS: TextBucket = {
	easy: [
		'The sun rose slowly over the quiet hills.',
		'She opened the window and let the cold air in.',
		'A small bird landed on the fence and sang.',
		'He wrote his name at the top of the page.',
		'The train arrived at the station right on time.',
		'Water in a glass looks different in the light.',
		'They walked along the path until the sun went down.',
		'The old book was full of notes from its first owner.',
		'A dog barked somewhere beyond the garden wall.',
		'He put the cup down and looked out of the window.',
		'The road curved around the lake and up into the hills.',
		'Most of the work was done before the rain came.',
		'She kept a list of every book she had ever read.',
		'The house at the end of the street was empty for years.',
		'He counted the steps all the way to the top.',
		'A message from a friend was waiting on the desk.',
		'The garden needs water twice a week in summer.',
		'They talked about the trip until the food went cold.',
		'Light from the lamp made the room feel warm.',
		'Every shelf in the shop held a different kind of book.',
		'She learned the song by heart in two days.',
		'The lake was calm and the sky was clear.',
		'He wrote down the number and put the paper away.',
		'The bus stop was at the end of the block.',
		'Rain fell all night and the ground was soaked by morning.',
		'She made a list of the things she still needed.',
		'The train pulled away and the platform emptied.',
		'A cold wind came down from the hills.',
		'The cat slept in the patch of sun on the floor.',
		'He read the last page and closed the book.',
		'They met again after many years apart.',
		'The shop opened at nine and closed at six.',
		'She walked home the long way through the park.',
		'The old clock in the hall had stopped years ago.',
		'A letter arrived with the morning post.',
		'He turned off the light and left the room.',
		'The mountains looked blue in the early morning.',
		'They finished the work a full week early.',
		'The wind carried the smell of rain across the field.',
	],

	medium: [
		'The report was finished late on Thursday, and nobody was surprised when it ran over into the weekend.',
		'She had been walking the same stretch of coast for years, and she still noticed something new almost every week.',
		'A good teacher does not simply explain the answer; she explains the reasoning that produced it.',
		'The library had been rebuilt twice, but the reading room had kept the same high windows and the same long tables.',
		'Most of the mistakes in the first draft were simple, and almost all of them disappeared during the second pass.',
		'When the machine finally stopped, the workshop was quiet enough to hear the rain on the roof.',
		'They planned the journey for months, and the plan worked exactly as intended for the first three days.',
		'The important part of the experiment was not the result, but the care taken to make the result repeatable.',
		'A short walk in the morning will do more for your head than an hour of staring at a screen in the evening.',
		'The committee agreed to postpone the decision until the following spring, when more data would be available.',
		'Learning a new keyboard layout is mostly a matter of patience, and patience is the part nobody practises.',
		'He kept a notebook of every mistake he made at work, and reread it at the end of each month.',
		'The house had been empty for so long that the garden had taken over the path entirely.',
		'There is a difference between reading quickly and reading well, and confusing the two is easy.',
		'Her notes from the seminar filled nine pages, but only three sentences in them were actually useful.',
		'The train was late, which gave the platform exactly enough time for an unexpected conversation.',
		'Nothing in the manual explained why the machine behaved differently on cold mornings.',
		'By the end of the first week, the routine had settled into something that felt less like practice and more like habit.',
		'The museum keeps its oldest instruments in a room that most visitors walk straight past.',
		'He asked whether the change would affect the old files, and the answer was that it would not.',
		'Typing well is less about moving your fingers quickly and more about knowing where they already are.',
		'The path up the hill is steep, but the view from the top is worth the extra fifteen minutes.',
		'They reviewed the numbers twice before deciding that the difference was too small to matter.',
		'A long afternoon of careful work produced less than a short morning of deliberate practice.',
		'The letter arrived without a return address, which made it impossible to answer.',
		'Every version of the design got simpler, and every version of the explanation got longer.',
		'He kept the old keyboard in a drawer for years, and it still worked perfectly well.',
		'The meeting ended without a decision, which everyone in the room had expected.',
		'Practice works best when it is short, frequent, and just slightly harder than comfortable.',
		'The first week is the hardest, and then the second week, and then it stops being hard at all.',
	],

	hard: [
		'Although the theory had been settled for decades, nobody had thought to check it against the data collected that winter, and when they finally did, the discrepancy was large enough to change the conclusion entirely.',
		'The interview lasted three hours, and for most of that time the two of them sat in silence, waiting for the other to speak first.',
		'He remembered the route he had taken that morning, not because it was unusual, but because the light had been unusual, falling across the street in a way that made the ordinary houses look temporary.',
		'Nothing in the report explained the delay, and rather than guess, the team spent a week instrumenting the pipeline until the answer became obvious, which was that nobody had owned it.',
		'The lesson, if there was one, was that a system that works reliably for a hundred people will not necessarily work for a hundred thousand, and the difference is almost always somewhere boring.',
		'She had promised herself she would finish the manuscript before the end of the year, and by November she had written half of it, which she considered reasonable progress given everything else.',
		'The catalogue lists the painting as attributed, which is the polite way of saying that nobody is entirely certain who painted it, and that several people have claimed the honour in print.',
		'Training a model is the part everyone talks about, but collecting the examples is the part that actually determines whether the result is any good.',
		'He had the rare gift of being able to explain a difficult idea in plain words, which meant that every explanation he gave made the original text look needlessly complicated.',
		'The building was scheduled for demolition in the spring, and for a few weeks the offices were filled with the strange energy of people finishing things they had been putting off for years.',
		'It is easy to measure speed and difficult to measure comprehension, which is why most typing tests settle for the easier of the two numbers and call the result a skill.',
		'After the third week of rain, the river rose above the footpath, and the walk to the station became a decision rather than a habit.',
		'The committee asked for a summary, and what they received was an argument, carefully structured, which was not what anyone had asked for.',
		'Her research looked, from the outside, like a collection of small tasks: a thousand measurements, a hundred interviews, and a great deal of time spent on the phone.',
		'The tool was simple enough to explain in a paragraph, which is usually a sign that the hard part has been moved somewhere else.',
		'Every version of the plan looked reasonable on its own, and that was exactly the problem, because no single document showed what happened when all of them were true at once.',
		'The interview transcript ran to forty pages, and reading it felt less like listening than like being let in on a conversation that had been going on for years.',
		'He had written the software in a weekend and spent the following six months finding out what it needed to do.',
	],

	paragraphs: [
		'Typing is one of the few everyday skills that can be measured precisely without asking anyone to sit down for an exam. A timer starts, a paragraph appears, and a number comes out the other end. That simplicity is misleading, though. The number only tells you what happened during one short window; it says nothing about whether the speed holds up over a long afternoon, or whether the accuracy survives contact with real work.',
		'Good touch typing is mostly a memory problem. Your fingers learn where the letters live, and after that the brain stops having to think about the keyboard at all. This is why the first few weeks feel slow and strange, and why the improvement afterwards arrives in bursts rather than a smooth curve. The skill is being built somewhere underneath conscious attention, and it shows up when you are not looking for it.',
		'Most people lose the first hour of a typing test to nerves. They hurry, they mistype, and the errors make them hurry more. A better approach is to type the first ten seconds slowly and accurately, then let the pace arrive on its own. Speed is a consequence of accuracy rather than a substitute for it, and the fastest typists are usually the ones who make fewer mistakes, not more.',
		'The value of practice depends almost entirely on what you practise. If you rehearse the motions you already know well, you will get very good at the motions you already know well. Typing lessons exist to push you towards the keys that still feel awkward, and they are worth far more than an afternoon of copying text you could already type.',
		'There is a practical limit to how fast anyone can type on a physical keyboard, and it is lower than most people expect. Beyond a certain point the bottleneck stops being the fingers and becomes the mind: you cannot read ahead, decide, and produce words at the same time. The fastest typists are not superhuman; they are simply reading and writing at the same time, and they have trained themselves to do it without noticing.',
		'A useful habit is to keep track of accuracy separately from speed. The two numbers move together for most people, but not always, and the moments where they diverge are the interesting ones. A week of fast typing with poor accuracy usually means the fingers are racing ahead of the reading. A week of slow, careful typing usually means the fingers are waiting for permission from a part of the brain that has not been trained yet.',
		'Short sessions work better than long ones. Ten focused minutes a day, with attention on the keys that cause trouble, will outperform an hour of half-hearted practice spread across a weekend. This is not a motivational point so much as a mechanical one: muscle memory consolidates between sessions, so what you do between them matters more than how long you sit there.',
		'There is no single correct way to type, but there are a few habits that cause long-term trouble. Resting the wrists on the desk limits the movement of the fingers. Reaching for the shift key with the wrong hand breaks the pattern that everything else depends on. Curling the fingers under the desk while searching for letters trains the hands to guess. None of these things feel wrong while you are doing them, which is exactly what makes them worth fixing.',
		'The most useful measurement you can take is not a single score but a pair of them. A speed without an accuracy figure is misleading, because it rewards the typist who makes a mess. An accuracy figure without a speed figure is useless, because very careful typing is not a skill anyone needs. Track both, and watch the pair of them move together over a month. That is the shape of real progress.',
		'Reading the text before you type it sounds obvious and is surprisingly hard to do. Typing letter by letter means your attention is one character behind your hands, and every mistake becomes a small interruption. Typing a word at a time, or even a short phrase at a time, keeps you further ahead, and it is the single change that most reliably lifts a test score.',
		'If you type for a living, the tools around you matter more than the test score. A keyboard with a comfortable layout, a screen at the right height, and a desk that does not make you hunch will do more for your output than any amount of drill. Then use the test as a check on your setup: a sudden dip in speed usually means something changed in the environment rather than in you.',
		'Nobody learns touch typing in a weekend, and anybody who tells you otherwise is selling something. But the curve is steeper than it looks for the first month, and after that the gains arrive in small, reliable steps. The interesting thing about typing is that it never becomes finished. Even people with a hundred words per minute are still finding small improvements in the pairs of letters they have never had to think about.',
	],

	punctuation: [
		'"We should leave before the traffic gets bad," she said, checking the time for the third time.',
		'The list was short: bread, milk, coffee, and — if the shop had any — good dark chocolate.',
		'"Is that everything?" asked the clerk. "Would you like a bag?"',
		'He paused, considered the question, and answered, "Honestly, I have no idea."',
		'Rules 1, 2, and 3 apply; rules 4 through 9 apply only to the north entrance.',
		'She typed the address carefully: 42 Alder Street, Apartment 3B, Bristol, BS1 4TR.',
		'"Wait — did you say Thursday or Tuesday?"',
		'The invoice (ref. 2291-A) was paid on 14 March 2019; the receipt was filed separately.',
		'He asked, "Who else knows?" — and nobody answered.',
		'"Try again," the coach said. "Slower. That is the whole secret."',
		'Between 9:00 a.m. and 5:30 p.m. the office is open; on Fridays it closes at 1:00 p.m.',
		'They tried the back door, then the side gate, then, finally, the front path.',
		'Costs ranged from $4.50 to $12.00, depending on size and finish.',
		'"No," he said firmly, "and I will not be changing my mind."',
		'Use the door marked "Staff Only" when the main entrance is closed.',
	],
};

/** Numeric drill material: telephone numbers, quantities and dates. */
export const NUMBER_DRILLS: readonly string[] = [
	'0724 118 940',
	'1,482,905.36',
	'3rd of September 1997',
	'+44 117 496 0233',
	'14, 27, 39, 52, 68',
	'2011 - 2014 - 2018',
	'0.75 1.5 2.25 3.125',
	'0191 496 0042',
	'42% of 1,750',
	'Room 214B, Level 3',
	'005 00 12 34',
	'1974 - 1988 - 2003 - 2019',
	'£18.50 + £2.75 VAT',
	'07:45 / 09:30 / 16:15',
	'1.234.567,89',
];

/** Keyboard drills that isolate a single pair of letters. */
export const KEY_DRILLS: readonly string[] = [
	'ff jj dd ss aa',
	'rr ee tt yy uu ii oo pp',
	'gg hh jj kk ll',
	'qq ww ee rr tt yy',
	'zz xx cc vv bb nn mm',
	'ff ll',
	'll ss ff',
	'aa dd gg jj kk',
];

/**
 * Home row drill material.
 *
 * Every character here sits on the home row of a standard keyboard, so the
 * fingers never have to guess a position: `a s d f` under the left hand,
 * `j k l ;` under the right, and the space bar under the thumbs. The list
 * mixes finger pair drills with the handful of real English words that can be
 * written without leaving the home row, so the exercise trains both the reach
 * and the rhythm.
 */
export const HOME_ROW_DRILLS: readonly string[] = [
	// Finger pair drills.
	'ff jj dd ss a;',
	'kk ll ;; jj a;',
	'as df jk l;',
	'sa; jf kd l; a',
	'fj fj dk dk sl sl',
	'a; s; d; f; j; k; l;',
	'jfkd ls;a fjdk sl;d',
	'fjfj dkdk slsl a;a;',
	'sj fj dk l; as df',
	'asdf jkl; fdsa',
	'ff jj dd ss kk ll a;',
	'df as l; kj fl dk sa',
	// Words that need nothing but home row keys.
	'ask add lad fad',
	'all alas ass sad',
	'dad fads lads lass',
	'fall flask salad salsa',
	'flasks salads falls asks',
	'add ask sad; lad',
	'alaska; ask a lass',
];

/** Human readable name for each mode, used in headings and labels. */
export const MODE_LABELS = {
	words: 'Words',
	sentences: 'Sentences',
	paragraphs: 'Paragraphs',
} as const;
