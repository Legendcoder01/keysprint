/**
 * Key sounds.
 *
 * The site ships three short recorded samples, all from the same family of
 * royalty-free field recordings:
 *
 * - `key-press` — an ordinary key (InspectorJ, "Computer Keyboard Pressing
 *   Single Key Releasing").
 * - `key-space` — the spacebar, which sounds heavier than a letter key
 *   (Audio Falcon, "Single Keyboard Click Spacebar").
 * - `key-wrong` — a mistake (Marcello Del Monaco, "wrong answer").
 *
 * Each is played from a pool of preloaded `Audio` elements so a fast typist
 * never waits for a file to load, and so two keystrokes in the same
 * millisecond do not cut each other off. Each sound keeps its own pool, which
 * keeps the burst bookkeeping honest: a mistake must not be quietened by the
 * letters typed just before it.
 *
 * Everything here is best effort. Autoplay policies reject `play()` until the
 * visitor has interacted with the page, the browser may refuse to decode the
 * files at all, and the visitor may have sound switched off. None of that may
 * interrupt a typing test, so every failure is swallowed and the drill carries
 * on silently.
 */

/** The three moments that make a sound. */
export type KeySoundName = 'press' | 'space' | 'wrong';

/**
 * Each moment's sample in three formats.
 *
 * The formats are handed to the browser in the order it can make most use of:
 * a single `Audio` element follows the `<source>` list the same way a `<video>`
 * element does, so the first one it can play wins.
 */
export const KEY_SOUND_SOURCES: Readonly<Record<KeySoundName, readonly string[]>> = {
	press: ['/sounds/key-press.m4a', '/sounds/key-press.ogg', '/sounds/key-press.mp3'],
	space: ['/sounds/key-space.m4a', '/sounds/key-space.ogg', '/sounds/key-space.mp3'],
	wrong: ['/sounds/key-wrong.m4a', '/sounds/key-wrong.ogg', '/sounds/key-wrong.mp3'],
};

/** How many copies of a sample can be in flight at once. */
const VOICE_COUNT = 4;

/** Volume per sound. A mistake should be noticed, not startling. */
const BASE_VOLUME: Readonly<Record<KeySoundName, number>> = {
	press: 0.45,
	space: 0.5,
	wrong: 0.5,
};

/** How much each re-trigger within a burst is quieted, and the floor. */
const DECAY = 0.78;
const MIN_VOLUME = 0.16;

/** A burst ends when this long passes with no keystroke. */
const BURST_GAP_MS = 60;

/**
 * Keystrokes come in bursts in ordinary typing, but holding a key or pasting
 * fires them back to back. Randomising the pitch slightly between voices keeps
 * the loop from sounding like a machine gun, and a gentle volume taper keeps a
 * burst from turning into a wall of sound.
 */
const MIN_RATE = 0.94;
const MAX_RATE = 1.06;

/**
 * A mistake is one event, not a rhythm, so it is never tapered and never
 * detuned. Repeating the exact same click would give away that the sound is
 * synthetic.
 */
const WRONG_RATE = 1;

interface Pool {
	voices: HTMLAudioElement[];
	nextVoice: number;
	lastPlayedAt: number;
	burstIndex: number;
	primed: boolean;
}

const pools: Partial<Record<KeySoundName, Pool>> = {};

/** Set once a sample fails, so the failure is not retried on every keystroke. */
const broken = new Set<KeySoundName>();

function pool(name: KeySoundName): Pool | null {
	const existing = pools[name];
	if (existing) return existing;
	if (broken.has(name)) return null;
	if (typeof Audio === 'undefined' || typeof document === 'undefined') return null;

	const created: Pool = { voices: [], nextVoice: 0, lastPlayedAt: 0, burstIndex: 0, primed: false };

	try {
		for (let index = 0; index < VOICE_COUNT; index += 1) {
			const voice = new Audio();
			voice.preload = 'auto';
			voice.volume = BASE_VOLUME[name];
			// A failed sample must not throw on every keystroke.
			voice.addEventListener('error', () => {
				broken.add(name);
			});
			for (const source of KEY_SOUND_SOURCES[name]) {
				const candidate = document.createElement('source');
				candidate.src = source;
				voice.append(candidate);
			}
			// The chosen format is not known until the browser has looked, so
			// the pool is only usable once a source has been selected.
			voice.load();
			created.voices.push(voice);
		}
	} catch {
		broken.add(name);
		return null;
	}

	pools[name] = created;
	return created;
}

/**
 * Warm every sample up so the first keystroke is not late.
 *
 * Called once on the first user interaction, when the browser is willing to
 * decode and buffer the files.
 */
export function primeKeySound(): void {
	for (const name of Object.keys(KEY_SOUND_SOURCES) as KeySoundName[]) {
		const target = pool(name);
		if (!target || target.primed) continue;
		try {
			for (const voice of target.voices) {
				// Loading is idempotent and does not play anything.
				if (voice.readyState === 0) voice.load();
			}
			target.primed = true;
		} catch {
			broken.add(name);
		}
	}
}

/**
 * Play one sample.
 *
 * `now` is the same clock the typing engine uses, so the burst detection
 * follows real typing rhythm rather than a second timer.
 */
function play(name: KeySoundName, now: number): void {
	const target = pool(name);
	if (!target || target.voices.length === 0) return;

	const steady = name === 'wrong';
	let volume = BASE_VOLUME[name];
	let rate = WRONG_RATE;

	if (!steady) {
		if (now - target.lastPlayedAt > BURST_GAP_MS) target.burstIndex = 0;
		else target.burstIndex = Math.min(target.burstIndex + 1, VOICE_COUNT * 2);
		target.lastPlayedAt = now;

		volume = Math.max(MIN_VOLUME, volume * DECAY ** target.burstIndex);
		rate = MIN_RATE + Math.random() * (MAX_RATE - MIN_RATE);
	}

	const voice = target.voices[target.nextVoice % target.voices.length];
	target.nextVoice += 1;
	if (!voice || voice.error) return;

	try {
		voice.pause();
		voice.currentTime = 0;
		voice.volume = volume;
		// `preservesPitch` keeps the samples sounding like keyboards rather
		// than sped-up recordings.
		voice.preservesPitch = false;
		voice.playbackRate = rate;
		// A rejected promise (autoplay policy, decoding) is expected and safe.
		void voice.play().catch(() => {});
	} catch {
		broken.add(name);
	}
}

/** An ordinary key was pressed. */
export function playKeySound(now: number = performance.now()): void {
	play('press', now);
}

/** The spacebar was pressed. */
export function playSpaceSound(now: number = performance.now()): void {
	play('space', now);
}

/** A wrong character was entered. */
export function playWrongSound(now: number = performance.now()): void {
	play('wrong', now);
}

/**
 * Play the right sound for one keystroke.
 *
 * Exactly one sample per keystroke: a space, a mistake and a correct letter
 * never overlap, so a fast run cannot turn into a wall of noise.
 */
export function playKeystroke(character: string, correct: boolean, now: number = performance.now()): void {
	if (!correct) playWrongSound(now);
	else if (character === ' ') playSpaceSound(now);
	else playKeySound(now);
}
