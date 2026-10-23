import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Keystroke sounds.
 *
 * The module talks straight to the browser audio stack, which does not exist
 * under Vitest's node environment. These tests install a small fake `Audio`
 * and `document` that record every call, then assert the two things that are
 * easy to get wrong and hard to notice by ear:
 *
 * 1. each keystroke makes exactly one sound, and
 * 2. the routing (space, wrong, ordinary) picks the right sample.
 *
 * They also pin the defensive behaviour: a sample that fails to decode must
 * disable itself without throwing, because audio must never break typing.
 */

interface FakeVoice {
	preload: string;
	volume: number;
	playbackRate: number;
	preservesPitch: boolean;
	currentTime: number;
	readyState: number;
	src: string;
	error: null;
	loadCalls: number;
	playCalls: number;
	pauseCalls: number;
	play: () => Promise<void>;
}

const created: FakeVoice[] = [];
/** Every `play()` call in order, with the volume and rate it ran at. */
let played: { src: string; volume: number; rate: number }[] = [];

class FakeAudio implements FakeVoice {
	preload = '';
	volume = 0;
	playbackRate = 1;
	preservesPitch = true;
	currentTime = 0;
	readyState = 0;
	src = '';
	error = null;
	loadCalls = 0;
	playCalls = 0;
	pauseCalls = 0;

	#sources: string[] = [];

	constructor() {
		created.push(this);
	}

	append(child: { src?: string }): void {
		if (child.src) this.#sources.push(child.src);
	}

	addEventListener(): void {
		/* error listeners are exercised by the dedicated failure test */
	}

	load(): void {
		this.loadCalls += 1;
	}

	pause(): void {
		this.pauseCalls += 1;
	}

	play(): Promise<void> {
		this.playCalls += 1;
		played.push({
			src: this.#sources[0] ?? this.src,
			volume: this.volume,
			rate: this.playbackRate,
		});
		return Promise.resolve();
	}
}

/** Re-import the module with a fresh module registry, so its pools are empty. */
async function freshModule() {
	vi.resetModules();
	return import('../src/scripts/key-sound');
}

beforeEach(() => {
	created.length = 0;
	played = [];
	vi.stubGlobal('Audio', FakeAudio);
	vi.stubGlobal('document', {
		createElement: () => ({ src: '' }),
	});
});

describe('playKeystroke', () => {
	it('plays exactly one sound per keystroke', async () => {
		const { playKeystroke } = await freshModule();
		playKeystroke('f', true, 1_000);
		expect(played).toHaveLength(1);
	});

	it('uses the space sample for a correct space', async () => {
		const { playKeystroke, KEY_SOUND_SOURCES } = await freshModule();
		playKeystroke(' ', true, 1_000);
		expect(played).toHaveLength(1);
		expect(played[0]?.src).toBe(KEY_SOUND_SOURCES.space[0]);
	});

	it('uses the wrong sample for a wrong character, whatever it was', async () => {
		const { playKeystroke, KEY_SOUND_SOURCES } = await freshModule();
		playKeystroke('z', false, 1_000);
		playKeystroke(' ', false, 1_200);
		expect(played.map((entry) => entry.src)).toEqual([
			KEY_SOUND_SOURCES.wrong[0],
			KEY_SOUND_SOURCES.wrong[0],
		]);
	});

	it('uses the ordinary sample for a correct letter', async () => {
		const { playKeystroke, KEY_SOUND_SOURCES } = await freshModule();
		playKeystroke('f', true, 1_000);
		expect(played[0]?.src).toBe(KEY_SOUND_SOURCES.press[0]);
	});

	it('never mixes samples within one keystroke', async () => {
		const { playKeystroke, KEY_SOUND_SOURCES } = await freshModule();
		const cases: [string, boolean][] = [
			['a', true],
			['z', false],
			[' ', true],
			['b', true],
			['1', false],
		];
		for (const [char, correct] of cases) playKeystroke(char, correct, 1_000);

		expect(played).toHaveLength(cases.length);
		for (const [index, [char, correct]] of cases.entries()) {
			const expected = !correct
				? KEY_SOUND_SOURCES.wrong[0]
				: char === ' '
					? KEY_SOUND_SOURCES.space[0]
					: KEY_SOUND_SOURCES.press[0];
			expect(played[index]?.src).toBe(expected);
		}
	});
});

describe('burst behaviour', () => {
	it('tapers repeated presses inside a burst but not after a pause', async () => {
		const { playKeySound } = await freshModule();
		playKeySound(1_000);
		playKeySound(1_020); // inside the burst gap
		const first = played[0]?.volume ?? 0;
		const second = played[1]?.volume ?? 0;
		expect(second).toBeLessThan(first);

		playKeySound(5_000); // long after the burst ended
		expect(played[2]?.volume).toBeCloseTo(first, 5);
	});

	it('never tapers the mistake buzzer, so a mistake always sounds like one', async () => {
		const { playWrongSound } = await freshModule();
		playWrongSound(1_000);
		playWrongSound(1_020);
		playWrongSound(1_040);
		expect(played).toHaveLength(3);
		const volumes = played.map((entry) => entry.volume);
		expect(new Set(volumes).size).toBe(1);
		expect(played.map((entry) => entry.rate)).toEqual([1, 1, 1]);
	});
});

describe('failure handling', () => {
	it('stays silent instead of throwing when audio is unavailable', async () => {
		vi.stubGlobal('Audio', class {
			constructor() {
				throw new Error('no audio here');
			}
		});
		const { playKeystroke, primeKeySound } = await freshModule();
		expect(() => primeKeySound()).not.toThrow();
		expect(() => playKeystroke('a', true, 1)).not.toThrow();
		expect(played).toHaveLength(0);
	});

	it('does nothing when the environment has no Audio at all', async () => {
		vi.stubGlobal('Audio', undefined);
		const { playKeystroke } = await freshModule();
		expect(() => playKeystroke('a', true, 1)).not.toThrow();
		expect(played).toHaveLength(0);
	});
});

describe('primeKeySound', () => {
	it('prepares every sample exactly once', async () => {
		const { primeKeySound } = await freshModule();
		primeKeySound();
		const loadsAfterFirst = created.map((voice) => voice.loadCalls);
		primeKeySound();
		expect(created.map((voice) => voice.loadCalls)).toEqual(loadsAfterFirst);
	});

	it('prepares all three sounds, so no first press is ever late', async () => {
		const { primeKeySound, KEY_SOUND_SOURCES } = await freshModule();
		primeKeySound();
		// Three sounds x four voices each.
		expect(Object.keys(KEY_SOUND_SOURCES)).toEqual(['press', 'space', 'wrong']);
		expect(created.length).toBe(12);
		expect(created.every((voice) => voice.loadCalls > 0)).toBe(true);
	});
});
