#!/usr/bin/env node
/**
 * Generates the Open Graph images for keysprint.
 *
 * The images are an optional build step, so `sharp` is deliberately *not* a
 * dependency of this project: it pulls in native binaries, and the site is
 * deployed to a free hosting tier where a failed install would break the
 * deploy for something that is not needed to serve the site. The committed PNGs
 * in `public/og/` are what the site actually uses.
 *
 * To regenerate them:
 *
 *     npm i -D sharp
 *     npm run og
 *
 * Every image is drawn as SVG and rasterised to a 1200x630 PNG, which is the
 * size Facebook, LinkedIn, Slack and X all expect.
 *
 * The script cannot look at the result, so nothing here is positioned by eye.
 * Every measurement that affects the layout — the width of a headline, the
 * advance of the monospace font, whether a line overflows its column — is
 * taken from the rendered pixels and checked before the file is accepted.
 */

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '..', 'public', 'og');

let sharp;
try {
	sharp = (await import('sharp')).default;
} catch {
	console.error(
		[
			'sharp is not installed, so the Open Graph images cannot be rendered.',
			'',
			'They are an optional step, which is why sharp is not a dependency of',
			'the project. Install it locally and run this script again:',
			'',
			'    npm i -D sharp',
			'    npm run og',
			'',
			'The committed PNGs in public/og/ are unaffected.',
		].join('\n'),
	);
	process.exit(1);
}

/* -------------------------------------------------------------------------
   Design tokens — the same palette the site uses in dark mode.
   ------------------------------------------------------------------------- */

const C = {
	canvas: '#09090b',
	surface: '#111113',
	surface2: '#18181b',
	border: '#27272a',
	ink: '#fafafa',
	inkMuted: '#a1a1aa',
	inkSubtle: '#71717a',
	accent: '#60a5fa',
	incorrect: '#fb7185',
};

const SANS = "Inter, Arial, Helvetica, 'Segoe UI', Roboto, 'Noto Sans', sans-serif";
const MONO = "Consolas, 'Liberation Mono', Menlo, 'DejaVu Sans Mono', monospace";

const W = 1200;
const H = 630;

/* -------------------------------------------------------------------------
   SVG helpers
   ------------------------------------------------------------------------- */

/** Escape a string for use inside XML text or an attribute value. */
function esc(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function text(x, y, content, options = {}) {
	const {
		size = 24,
		fill = C.ink,
		weight = 400,
		family = SANS,
		anchor = 'start',
		spacing = 0,
	} = options;
	const attrs = [
		`x="${x}"`,
		`y="${y}"`,
		`font-family="${family}"`,
		`font-size="${size}"`,
		`font-weight="${weight}"`,
		`fill="${fill}"`,
	];
	if (anchor !== 'start') attrs.push(`text-anchor="${anchor}"`);
	if (spacing) attrs.push(`letter-spacing="${spacing}"`);
	return `<text ${attrs.join(' ')}>${esc(content)}</text>`;
}

function rect(x, y, w, h, options = {}) {
	const { fill = 'none', radius = 0, stroke = null, strokeWidth = 1 } = options;
	const attrs = [`x="${x}"`, `y="${y}"`, `width="${w}"`, `height="${h}"`];
	if (radius) attrs.push(`rx="${radius}"`, `ry="${radius}"`);
	attrs.push(`fill="${fill}"`);
	if (stroke) attrs.push(`stroke="${stroke}"`, `stroke-width="${strokeWidth}"`);
	return `<rect ${attrs.join(' ')} />`;
}

function line(x1, y1, x2, y2, stroke, strokeWidth = 1) {
	return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

/** Wrap a group of SVG elements in a canvas. */
function canvas(elements, width = W, height = H) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join(
		'',
	)}</svg>`;
}

/* -------------------------------------------------------------------------
   Measurement
   ------------------------------------------------------------------------- */

/**
 * Find the bounding box of the visible pixels in an SVG.
 *
 * The script cannot look at the rendered image, so every layout decision that
 * depends on how wide a piece of text turned out to be is checked against the
 * actual pixels instead of against a guess.
 */
async function measureInk(svg) {
	const { data, info } = await sharp(Buffer.from(svg))
		.raw()
		.toBuffer({ resolveWithObject: true });
	const channels = info.channels;
	let top = info.height;
	let bottom = -1;
	let left = info.width;
	let right = -1;

	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const offset = (y * info.width + x) * channels;
			const alpha = channels === 4 ? data[offset + 3] : 255;
			if (alpha > 8) {
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
		}
	}

	if (right < 0) return null;
	return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

const widthCache = new Map();

/** Rendered width of a single line of text, in pixels. */
async function measureWidth(value, options) {
	const key = [
		options.size,
		options.weight ?? 400,
		options.family ?? SANS,
		options.spacing ?? 0,
		value,
	].join('|');
	const cached = widthCache.get(key);
	if (cached !== undefined) return cached;

	const svg = canvas([text(20, 90, value, { ...options, fill: '#000' })], 2200, 140);
	const box = await measureInk(svg);
	const width = box ? box.width : 0;
	widthCache.set(key, width);
	return width;
}

/**
 * Measure the horizontal advance of the monospace font.
 *
 * Two runs of the same string differ by exactly one hundred advances, which
 * cancels out the side bearings and leaves the true advance.
 */
async function measureMonoAdvance(size, weight = 400) {
	// A wide canvas so a long run of characters is never clipped.
	const run = (count) =>
		canvas([text(20, 80, 'm'.repeat(count), { size, weight, family: MONO, fill: '#000' })], 4000, 120);
	const a = await measureInk(run(101));
	const b = await measureInk(run(201));
	if (!a || !b) throw new Error('Could not measure the monospace font.');
	return (b.width - a.width) / 100;
}

/* -------------------------------------------------------------------------
   Fitting text
   ------------------------------------------------------------------------- */

/** Break a sentence into lines that each fit inside `maxWidth`. */
async function wrapText(value, options, maxWidth) {
	const words = String(value).split(/\s+/).filter(Boolean);
	const lines = [];
	let current = '';

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (current && (await measureWidth(candidate, options)) > maxWidth) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);
	return lines;
}

/** The largest font size at which every line still fits inside `maxWidth`. */
async function fitTextSize(lines, options, maxWidth, startSize, minSize) {
	let size = startSize;
	while (size > minSize) {
		let fits = true;
		for (const line of lines) {
			if ((await measureWidth(line, { ...options, size })) > maxWidth) {
				fits = false;
				break;
			}
		}
		if (fits) return size;
		size -= 2;
	}
	return minSize;
}

/* -------------------------------------------------------------------------
   The mock typing widget shown on the right of every image
   ------------------------------------------------------------------------- */

const PANEL = { x: 700, y: 90, w: 452, h: 450, pad: 28 };

/** The passage the mock widget is typing, with the caret on the third line. */
const MOCK_LINES = [
	{ text: 'She opened the window and let', typed: 29, errorAt: 11 },
	{ text: 'the cold air in.', typed: 15, errorAt: -1 },
	{ text: 'A small bird landed on the', typed: 9, errorAt: -1 },
	{ text: 'fence and sang.', typed: 0, errorAt: -1 },
];

function buildPanel(spec, advance) {
	const { x, y, w, h, pad } = PANEL;
	const innerX = x + pad;
	const innerW = w - pad * 2;
	const frame = [];
	const content = [];

	frame.push(rect(x, y, w, h, { fill: C.surface, radius: 20, stroke: C.border }));

	// Header: the drill name on the left, the clock on the right.
	content.push(
		text(innerX, y + 44, spec.panel.drill.toUpperCase(), {
			size: 15,
			weight: 700,
			spacing: 2,
			fill: C.inkSubtle,
		}),
	);
	content.push(
		text(x + w - pad, y + 46, spec.panel.timer, {
			size: 22,
			family: MONO,
			fill: C.accent,
			anchor: 'end',
		}),
	);
	content.push(line(innerX, y + 66, x + w - pad, y + 66, C.border));

	// The passage, one character at a time so each one can be coloured.
	const fontSize = 21;
	const baseline0 = y + 110;
	const lineHeight = 40;
	MOCK_LINES.forEach((entry, index) => {
		const baseline = baseline0 + index * lineHeight;
		for (let i = 0; i < entry.text.length; i += 1) {
			const typed = i < entry.typed;
			const wrong = typed && i === entry.errorAt;
			const fill = wrong ? C.incorrect : typed ? C.ink : C.inkSubtle;
			content.push(
				text(innerX + i * advance, baseline, entry.text[i], { size: fontSize, family: MONO, fill }),
			);
		}
	});

	// The caret sits on the line the typist is working on.
	const caretLine = MOCK_LINES[2];
	const caretX = innerX + caretLine.typed * advance;
	const caretBaseline = baseline0 + 2 * lineHeight;
	content.push(rect(caretX, caretBaseline - fontSize * 0.92, 3, fontSize * 1.18, { fill: C.accent }));

	// The three headline statistics.
	const boxY = y + 300;
	const boxH = 110;
	const gap = 16;
	const boxW = (innerW - gap * 2) / 3;
	const stats = [
		{ label: 'WPM', value: spec.panel.wpm },
		{ label: 'ACC', value: spec.panel.acc },
		{ label: 'ERR', value: spec.panel.err },
	];
	stats.forEach((stat, index) => {
		const bx = innerX + index * (boxW + gap);
		content.push(rect(bx, boxY, boxW, boxH, { fill: C.surface2, radius: 12 }));
		content.push(
			text(bx + 18, boxY + 36, stat.label, {
				size: 14,
				weight: 700,
				spacing: 1.6,
				fill: C.inkSubtle,
			}),
		);
		content.push(
			text(bx + 18, boxY + 86, stat.value, { size: 38, weight: 700, family: MONO, fill: C.ink }),
		);
	});

	return { frame, content };
}

/* -------------------------------------------------------------------------
   The copy column
   ------------------------------------------------------------------------- */

const LEFT_X = 72;
const LEFT_LIMIT = 648;
const COLUMN_WIDTH = LEFT_LIMIT - LEFT_X;

async function buildCopy(spec) {
	const parts = [];

	// Brand mark.
	parts.push(rect(LEFT_X, 56, 16, 16, { fill: C.accent, radius: 4 }));
	parts.push(text(LEFT_X + 28, 74, 'keysprint', { size: 26, weight: 700, fill: C.ink }));

	// Eyebrow.
	parts.push(text(LEFT_X, 190, spec.eyebrow, { size: 24, weight: 700, spacing: 3, fill: C.accent }));

	// Headline, one or two lines, shrunk until it fits the column.
	const lines = Array.isArray(spec.headline) ? spec.headline : [spec.headline];
	const headlineSize = await fitTextSize(
		lines,
		{ weight: 700 },
		COLUMN_WIDTH,
		lines.length > 1 ? 62 : 68,
		46,
	);
	lines.forEach((line, index) => {
		parts.push(text(LEFT_X, 278 + index * 76, line, { size: headlineSize, weight: 700, fill: C.ink }));
	});

	// Sub-heading, wrapped to the column width.
	let cursor = 278 + (lines.length - 1) * 76 + 58;
	const subLines = await wrapText(spec.sub, { size: 27 }, COLUMN_WIDTH);
	for (const line of subLines) {
		parts.push(text(LEFT_X, cursor, line, { size: 27, fill: C.inkMuted }));
		cursor += 38;
	}

	// Supporting details.
	cursor += 10;
	const detailLines = await wrapText(spec.detail, { size: 22, spacing: 1 }, COLUMN_WIDTH);
	for (const line of detailLines) {
		parts.push(text(LEFT_X, cursor, line, { size: 22, spacing: 1, fill: C.inkSubtle }));
		cursor += 30;
	}

	// The promise.
	cursor += 14;
	const promiseLines = await wrapText(spec.promise, { size: 23, weight: 600 }, COLUMN_WIDTH);
	for (const line of promiseLines) {
		parts.push(text(LEFT_X, cursor, line, { size: 23, weight: 600, fill: C.accent }));
		cursor += 32;
	}

	return { parts, bottom: cursor };
}

/* -------------------------------------------------------------------------
   Image specifications
   ------------------------------------------------------------------------- */

const durationImage = (seconds, timer, headline) => ({
	file: `typing-test-${seconds}.png`,
	eyebrow: 'TYPING TEST',
	headline,
	sub: 'Gross and net speed, character and word accuracy, and an error count.',
	detail: '15s · 30s · 1m · 3m · 5m · 10m',
	promise: 'Free. No sign-up. No ads.',
	panel: { drill: 'words', timer, wpm: '84', acc: '97', err: '3' },
});

const IMAGES = [
	{
		file: 'default.png',
		eyebrow: 'FREE ONLINE TYPING TEST',
		headline: ['How fast can', 'you type?'],
		sub: 'Measure your words per minute and accuracy, then practise whatever is slow.',
		detail: '15s · 30s · 1m · 3m · 5m · 10m',
		promise: 'Free forever — no sign-up, no ads.',
		panel: { drill: 'words', timer: '1:00', wpm: '84', acc: '97', err: '3' },
	},
	{
		file: 'typing-test.png',
		eyebrow: 'TYPING TEST',
		headline: ['A typing test', 'in one minute'],
		sub: 'Every test length and text type, switchable without reloading the page.',
		detail: '15s · 30s · 1m · 3m · 5m · 10m',
		promise: 'Your best score stays in your browser.',
		panel: { drill: 'words', timer: '1:00', wpm: '84', acc: '97', err: '3' },
	},
	durationImage('15s', '0:15', ['A quick check', 'on your speed']),
	durationImage('30s', '0:30', ['Half a minute', 'to a number']),
	durationImage('60s', '1:00', ['One minute', 'is the standard']),
	durationImage('180s', '3:00', ['Three minutes', 'shows your rhythm']),
	durationImage('300s', '5:00', ['Five minutes', 'is the test']),
	durationImage('600s', '10:00', ['Ten minutes', 'the real one']),
	{
		file: 'accuracy.png',
		eyebrow: 'ACCURACY TEST',
		headline: ['How clean is', 'your typing?'],
		sub: 'Character accuracy, word accuracy and keystroke accuracy, side by side.',
		detail: 'Every mistake counted, nothing rounded in your favour.',
		promise: 'Accuracy first, speed second.',
		panel: { drill: 'words', timer: '1:00', wpm: '71', acc: '99', err: '1' },
	},
	{
		file: 'learn.png',
		eyebrow: 'LEARN TYPING',
		headline: ['The guide to', 'touch typing'],
		sub: 'Finger positions, posture, reading ahead and how speed actually happens.',
		detail: 'Home row first, then outward from there.',
		promise: 'Written for beginners who mean it.',
		panel: { drill: 'words', timer: '1:00', wpm: '58', acc: '94', err: '6' },
	},
	{
		file: 'lessons.png',
		eyebrow: 'TYPING LESSONS',
		headline: ['One key row', 'at a time'],
		sub: 'A staged curriculum, from the home row to the number row.',
		detail: 'Home row · Middle row · Top row · Bottom row',
		promise: 'Ten minutes a day is enough.',
		panel: { drill: 'home row', timer: '0:30', wpm: '46', acc: '98', err: '2' },
	},
	{
		file: 'practice.png',
		eyebrow: 'PRACTICE DRILLS',
		headline: ['Practise the', 'hard parts'],
		sub: 'Paragraphs, numbers and punctuation, with the same live test underneath.',
		detail: 'Reading ahead · The number row · The shift key',
		promise: 'Test, drill, test. Repeat weekly.',
		panel: { drill: 'paragraphs', timer: '1:00', wpm: '67', acc: '93', err: '5' },
	},
	{
		file: 'analysis.png',
		eyebrow: 'TYPING ANALYSIS',
		headline: ['Find the keys', 'that cost you speed'],
		sub: 'A per-key accuracy heat map built from your own tests, with a drill beside every weak key.',
		detail: 'Per-key accuracy · Fingers · Practice drills',
		promise: 'Stored on your device. Never uploaded.',
		panel: { drill: 'words', timer: '1:00', wpm: '84', acc: '97', err: '3' },
	},
];

/* -------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------- */

await mkdir(OUT_DIR, { recursive: true });

const advance = await measureMonoAdvance(21);
console.log(`Measured monospace advance: ${advance.toFixed(3)}px at 21px.`);

const problems = [];

for (const spec of IMAGES) {
	const copy = await buildCopy(spec);
	const panel = buildPanel(spec, advance);

	const background = [
		rect(0, 0, W, H, { fill: C.canvas }),
		'<defs><radialGradient id="glow" cx="50%" cy="50%" r="50%">' +
			`<stop offset="0%" stop-color="${C.accent}" stop-opacity="0.20" />` +
			`<stop offset="100%" stop-color="${C.accent}" stop-opacity="0" />` +
			'</radialGradient></defs>',
		'<ellipse cx="920" cy="150" rx="520" ry="420" fill="url(#glow)" />',
	];

	const output = path.join(OUT_DIR, spec.file);
	await sharp(Buffer.from(canvas([...background, ...copy.parts, ...panel.frame, ...panel.content])))
		.png({ compressionLevel: 9 })
		.toFile(output);

	// Validation: the copy must stay inside the left column, and the panel
	// content must stay inside its own frame.
	const copyBox = await measureInk(canvas(copy.parts));
	const panelBox = await measureInk(canvas(panel.content));

	if (copyBox) {
		if (copyBox.right > LEFT_LIMIT) {
			problems.push(`${spec.file}: copy overflows the left column (${copyBox.right} > ${LEFT_LIMIT}).`);
		}
		if (copyBox.bottom > H - 24) {
			problems.push(`${spec.file}: copy overflows the bottom of the canvas (${copyBox.bottom}).`);
		}
	}
	if (panelBox) {
		if (panelBox.left < PANEL.x + PANEL.pad - 2) {
			problems.push(`${spec.file}: panel content starts left of the panel padding (${panelBox.left}).`);
		}
		if (panelBox.right > PANEL.x + PANEL.w - PANEL.pad + 2) {
			problems.push(`${spec.file}: panel content overflows the panel padding (${panelBox.right}).`);
		}
		if (panelBox.bottom > PANEL.y + PANEL.h - PANEL.pad + 2) {
			problems.push(`${spec.file}: panel content overflows the panel padding (${panelBox.bottom}).`);
		}
	}

	const meta = await sharp(output).metadata();
	const { size } = await stat(output);
	console.log(
		`  ${spec.file.padEnd(24)} ${meta.width}x${meta.height}  ${(size / 1024).toFixed(1)} kB`,
	);
}

if (problems.length > 0) {
	console.error('\nLayout problems found:');
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log(`\nWrote ${IMAGES.length} images to ${OUT_DIR}`);
