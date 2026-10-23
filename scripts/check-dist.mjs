#!/usr/bin/env node
/**
 * Checks the built site in `dist/`.
 *
 * This runs against the output rather than the source, so it catches the
 * things a source-level review cannot: a link to a page that was renamed, an
 * image referenced in a meta tag that was never generated, a canonical URL that
 * points somewhere else, or a JSON-LD block that is not valid JSON.
 *
 *     npm run build
 *     npm run check:dist
 *
 * It exits non-zero when anything fails, so it can be used as a gate.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');

/** The pages the site is supposed to have. */
const EXPECTED_PAGES = [
	'/',
	'/404.html',
	'/about/',
	'/contact/',
	'/learn-typing/',
	'/privacy-policy/',
	'/terms/',
	'/typing-analysis/',
	'/typing-lessons/',
	'/typing-lessons/home-row/',
	'/typing-lessons/index-fingers/',
	'/typing-lessons/middle-fingers/',
	'/typing-lessons/ring-fingers/',
	'/typing-lessons/little-fingers/',
	'/typing-lessons/upper-row/',
	'/typing-lessons/lower-row/',
	'/typing-lessons/capitals-shift/',
	'/typing-lessons/numbers-punctuation/',
	'/typing-lessons/mixed-practice/',
	'/typing-practice/',
	'/typing-practice/numbers/',
	'/typing-practice/paragraphs/',
	'/typing-practice/punctuation/',
	'/typing-test/',
	'/typing-test/1-minute/',
	'/typing-test/3-minute/',
	'/typing-test/5-minute/',
	'/typing-test/10-minute/',
	'/typing-test/15-second/',
	'/typing-test/30-second/',
	'/typing-test/accuracy/',
	'/typing-test/words-per-minute/',
];

/**
 * Sound files the typing engine loads from JavaScript.
 *
 * Because they are requested from script rather than named in markup, the
 * `src`/`href` sweep below never sees them. A missing or renamed sample would
 * therefore ship silently, so they are listed explicitly. Each sound ships in
 * three container formats so every browser has something it can decode.
 */
const SOUND_NAMES = ['key-press', 'key-space', 'key-wrong'];
const SOUND_FORMATS = ['m4a', 'ogg', 'mp3'];
const EXPECTED_SOUNDS = SOUND_NAMES.flatMap((name) =>
	SOUND_FORMATS.map((format) => `/sounds/${name}.${format}`),
);

const errors = [];
const warnings = [];

function fail(message) {
	errors.push(message);
}

function warn(message) {
	warnings.push(message);
}

/* -------------------------------------------------------------------------
   Collect the built pages
   ------------------------------------------------------------------------- */

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(full)));
		} else {
			files.push(full);
		}
	}
	return files;
}

let allFiles;
try {
	allFiles = await walk(DIST);
} catch {
	console.error(`No build output at ${DIST}. Run "npm run build" first.`);
	process.exit(1);
}

const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const otherFiles = allFiles.filter((file) => !file.endsWith('.html'));

/** Map a site-relative URL onto the file that serves it. */
function resolve(urlPath) {
	const clean = urlPath.split('#')[0].split('?')[0];
	if (clean === '' || clean === '/') return path.join(DIST, 'index.html');
	if (clean.endsWith('/')) return path.join(DIST, clean, 'index.html');
	return path.join(DIST, clean);
}

/* -------------------------------------------------------------------------
   Page level checks
   ------------------------------------------------------------------------- */

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
const jsonLdTypes = new Map();

for (const file of htmlFiles) {
	const html = await readFile(file, 'utf8');
	const route = `/${path.relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '')}`;

	const pick = (pattern) => {
		const match = html.match(pattern);
		return match ? match[1].trim() : null;
	};

	const title = pick(/<title>([\s\S]*?)<\/title>/);
	const description = pick(/<meta name="description" content="([^"]*)"/);
	const canonical = pick(/<link rel="canonical" href="([^"]*)"/);
	const ogImage = pick(/<meta property="og:image" content="([^"]*)"/);
	const ogTitle = pick(/<meta property="og:title" content="([^"]*)"/);
	const robots = pick(/<meta name="robots" content="([^"]*)"/);

	if (!title) fail(`${route}: missing <title>.`);
	if (!description) fail(`${route}: missing meta description.`);
	if (!canonical) fail(`${route}: missing canonical link.`);
	if (!ogImage) fail(`${route}: missing og:image.`);
	if (!ogTitle) fail(`${route}: missing og:title.`);
	if (!robots) fail(`${route}: missing robots meta.`);
	if (!/<meta name="viewport"/.test(html)) fail(`${route}: missing viewport meta.`);
	if (!/<html lang="en"/.test(html)) fail(`${route}: missing lang attribute on <html>.`);

	// Titles and descriptions must be unique across the site. Canonical URLs
	// must be unique too, except for the 404 page, which shares the home page.
	for (const [value, map, label] of [
		[title, titles, 'title'],
		[description, descriptions, 'meta description'],
		[route === '/404.html' ? null : canonical, canonicals, 'canonical'],
	]) {
		if (!value) continue;
		if (map.has(value)) {
			fail(`${route}: duplicate ${label} — "${value}" is also used by ${map.get(value)}.`);
		} else {
			map.set(value, route);
		}
	}

	if (title && (title.length < 15 || title.length > 70)) {
		warn(`${route}: title is ${title.length} characters (aim for 15-70).`);
	}
	if (description && (description.length < 70 || description.length > 175)) {
		warn(`${route}: meta description is ${description.length} characters (aim for 70-175).`);
	}

	// The canonical URL must be absolute and must match the route.
	if (canonical && !/^https:\/\//.test(canonical)) {
		fail(`${route}: canonical is not an absolute URL (${canonical}).`);
	}
	if (canonical) {
		const canonicalPath = new URL(canonical).pathname;
		const is404 = route === '/404.html';
		if (is404) {
			// The 404 page has no URL of its own, so it points at the home page.
			if (canonicalPath !== '/') {
				fail(`${route}: canonical should point at the home page, not ${canonicalPath}.`);
			}
		} else if (canonicalPath !== route) {
			fail(`${route}: canonical path ${canonicalPath} does not match the route.`);
		}
	}

	// The social image must exist in the build output.
	if (ogImage) {
		const ogPath = new URL(ogImage).pathname;
		if (!allFiles.includes(resolve(ogPath))) {
			fail(`${route}: og:image ${ogPath} is not in the build output.`);
		}
	}

	// JSON-LD must be valid JSON, and each node must have a type.
	const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
	for (const block of blocks) {
		let parsed;
		try {
			parsed = JSON.parse(block[1]);
		} catch (error) {
			fail(`${route}: JSON-LD block is not valid JSON (${error.message}).`);
			continue;
		}
		for (const node of parsed ? [parsed] : []) {
			const type = node['@type'];
			if (!type) fail(`${route}: a JSON-LD node has no @type.`);
			const list = jsonLdTypes.get(type) ?? [];
			list.push(route);
			jsonLdTypes.set(type, list);

			// The structured data must not claim a rating, a review or a price
			// that the site does not actually have.
			if (node.aggregateRating) {
				fail(`${route}: structured data claims an aggregate rating.`);
			}
			if (node.review) {
				fail(`${route}: structured data claims a review.`);
			}
			for (const offer of [].concat(node.offers ?? [])) {
				const price = String(offer.price ?? '0');
				if (price !== '0' && price !== '0.00') {
					fail(`${route}: structured data claims a price of ${price}.`);
				}
			}
		}
	}

	// Every internal link must resolve to a file in the build output.
	const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
	for (const link of links) {
		if (/^(https?:|mailto:|tel:|#|data:)/i.test(link)) continue;
		const target = resolve(link);
		if (!allFiles.includes(target)) {
			fail(`${route}: link to "${link}" does not resolve to a built file.`);
		}
	}

	// Every local asset referenced by a src or a stylesheet must exist.
	const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:png|svg|jpg|jpeg|webp|avif|css|js|woff2?))"/g)].map(
		(match) => match[1],
	);
	for (const asset of assets) {
		if (!allFiles.includes(resolve(asset))) {
			fail(`${route}: asset "${asset}" is not in the build output.`);
		}
	}

	/* -- document structure ------------------------------------------------ */

	// One <h1> per page, no empty headings, and no skipped heading levels.
	const headings = [...html.matchAll(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g)];
	let previousLevel = 0;
	for (const [, level, , inner] of headings) {
		const text = inner
			.replace(/<[^>]*>/g, '')
			.replace(/&[a-z]+;|&#\d+;/gi, '')
			.trim();
		if (!text) {
			fail(`${route}: an <h${level}> has no text.`);
		}
		const current = Number(level);
		if (previousLevel === 0 && current !== 1) {
			fail(`${route}: the first heading is an <h${current}>, not an <h1>.`);
		}
		if (previousLevel > 0 && current > previousLevel + 1) {
			fail(`${route}: heading level jumps from h${previousLevel} to h${current}.`);
		}
		previousLevel = current;
	}
	const h1Count = headings.filter(([, level]) => level === '1').length;
	if (h1Count !== 1) {
		fail(`${route}: expected exactly one <h1>, found ${h1Count}.`);
	}

	// Every image needs an alt attribute, even if the attribute is empty
	// (an empty alt marks an image as decorative).
	for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
		if (!/\salt\s*=/.test(tag)) {
			fail(`${route}: an <img> has no alt attribute.`);
		}
	}

	// The skip link must be the first focusable element in the body.
	if (!/<body[^>]*>\s*<a\s+href="#main"/.test(html)) {
		fail(`${route}: the skip link is not the first element in <body>.`);
	}
}

/* -------------------------------------------------------------------------
   Expected pages
   ------------------------------------------------------------------------- */

for (const page of EXPECTED_PAGES) {
	const file = resolve(page);
	if (!allFiles.includes(file)) {
		fail(`Expected page "${page}" was not built (${path.relative(DIST, file)}).`);
	}
}

/* -------------------------------------------------------------------------
   Sitemap
   ------------------------------------------------------------------------- */

const sitemapIndex = path.join(DIST, 'sitemap-index.xml');
if (!allFiles.includes(sitemapIndex)) {
	fail('sitemap-index.xml was not generated.');
} else {
	const index = await readFile(sitemapIndex, 'utf8');
	const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
	let urls = [];
	for (const child of children) {
		const childPath = path.join(DIST, new URL(child).pathname.replace(/^\//, ''));
		const content = await readFile(childPath, 'utf8');
		urls.push(...[...content.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
	}

	// Read the origin from the built home page rather than assuming a host.
	// This keeps the gate valid for Render, GitHub Pages and custom domains.
	const homeHtml = await readFile(path.join(DIST, 'index.html'), 'utf8');
	const homeCanonical = homeHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
	const origin = homeCanonical ? new URL(homeCanonical).origin : 'https://keysprint.onrender.com';

	for (const page of EXPECTED_PAGES) {
		if (page === '/404.html') continue;
		const expected = `${origin}${page}`;
		if (!urls.includes(expected)) {
			fail(`Sitemap is missing ${expected}.`);
		}
	}
	if (urls.includes(`${origin}/404.html`)) {
		fail('Sitemap contains the 404 page.');
	}
}

/* -------------------------------------------------------------------------
   robots.txt
   ------------------------------------------------------------------------- */

const robotsFile = path.join(DIST, 'robots.txt');
if (!allFiles.includes(robotsFile)) {
	fail('robots.txt was not generated.');
} else {
	const robots = await readFile(robotsFile, 'utf8');
	if (!/^Sitemap: https?:\/\/\S+\/sitemap-index\.xml$/m.test(robots)) {
		fail('robots.txt does not point at the XML sitemap.');
	}
	if (/^Disallow: \/$/m.test(robots)) {
		fail('robots.txt disallows the whole site.');
	}
}

/* -------------------------------------------------------------------------
   Keystroke sounds
   ------------------------------------------------------------------------- */

// These are fetched from JavaScript, so nothing in the markup points at them.
// A missing sample would be inaudible in review but broken for the visitor.
for (const sound of EXPECTED_SOUNDS) {
	const file = resolve(sound);
	if (!allFiles.includes(file)) {
		fail(`sound "${sound}" is not in the build output.`);
		continue;
	}
	const { size } = await stat(file);
	// A real one-shot sample is small but never empty; an empty file means the
	// encode step produced nothing.
	if (size < 512) {
		fail(`sound "${sound}" is only ${size} bytes, which cannot be a usable sample.`);
	}
}

/* -------------------------------------------------------------------------
   Report
   ------------------------------------------------------------------------- */

console.log(`Checked ${htmlFiles.length} pages and ${otherFiles.length} assets.`);

console.log('\nStructured data by type:');
for (const [type, routes] of [...jsonLdTypes].sort()) {
	console.log(`  ${type.padEnd(20)} ${routes.length} page(s)`);
}

if (warnings.length > 0) {
	console.log(`\n${warnings.length} warning(s):`);
	for (const message of warnings) console.log(`  - ${message}`);
}

if (errors.length > 0) {
	console.error(`\n${errors.length} error(s):`);
	for (const message of errors) console.error(`  - ${message}`);
	process.exit(1);
}

console.log('\nNo problems found.');
