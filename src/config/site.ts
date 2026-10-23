/**
 * Centralised site + SEO configuration.
 *
 * Every canonical URL, Open Graph tag, Twitter card tag and JSON-LD node on the
 * site is derived from the constants in this file, so the production domain and
 * the default social image only ever need to be changed in one place.
 *
 * The origin resolves from the `SITE_URL` environment variable (see
 * `.env.example`), falling back to the GitHub Pages origin. The base path comes
 * from Astro's `base` setting, so canonical URLs and JSON-LD include
 * `/keysprint/` on the deployed project site.
 */

import { BASE_PATH, stripBase, withBase } from './paths';

const DEFAULT_SITE_URL = 'https://legendcoder01.github.io';

/** Strip trailing slashes so `absoluteUrl()` never produces a double slash. */
function normalizeOrigin(raw: string): string {
	return raw.trim().replace(/\/+$/, '');
}

/** The production origin, without the base path. */
export const SITE_ORIGIN = normalizeOrigin(import.meta.env.SITE_URL || DEFAULT_SITE_URL);

/**
 * The canonical site address, including the base path.
 *
 * `https://legendcoder01.github.io/keysprint` on GitHub Pages, or the bare
 * origin when the site is deployed at a domain root.
 */
export const SITE_URL = BASE_PATH === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${BASE_PATH}`;

export const SITE_NAME = 'keysprint';

export const SITE_LOCALE = 'en_US';

export const SITE_TAGLINE = 'Free online typing test, speed measurement, and touch-typing lessons.';

export const SITE_DESCRIPTION =
	'Take a free online typing test to measure your words per minute and accuracy. Practice touch typing with structured lessons, drills, and progress tracking. No sign-up required.';

/** Default social sharing image (1200x630) served from `public/og/`. */
export const OG_IMAGE = '/og/default.png';

export const OG_IMAGE_ALT =
	'keysprint — a free online typing test showing a typing speed measurement in words per minute.';

/** Build an absolute URL from a site-relative path, including the base path. */
export function absoluteUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	return `${SITE_ORIGIN}${withBase(path)}`;
}

export { BASE_PATH, stripBase, withBase };

/** Primary navigation shown in the header. */
export const PRIMARY_NAV = [
	{ label: 'Typing Test', href: '/typing-test/' },
	{ label: 'Learn', href: '/learn-typing/' },
	{ label: 'Lessons', href: '/typing-lessons/' },
	{ label: 'Practice', href: '/typing-practice/' },
	{ label: 'About', href: '/about/' },
] as const;

/** Secondary links shown in the footer. */
export const FOOTER_NAV = [
	{
		heading: 'Typing tests',
		links: [
			{ label: 'Typing test', href: '/typing-test/' },
			{ label: '15 second typing test', href: '/typing-test/15-second/' },
			{ label: '30 second typing test', href: '/typing-test/30-second/' },
			{ label: '1 minute typing test', href: '/typing-test/1-minute/' },
			{ label: '3 minute typing test', href: '/typing-test/3-minute/' },
			{ label: '5 minute typing test', href: '/typing-test/5-minute/' },
			{ label: '10 minute typing test', href: '/typing-test/10-minute/' },
			{ label: 'Words per minute test', href: '/typing-test/words-per-minute/' },
			{ label: 'Typing accuracy test', href: '/typing-test/accuracy/' },
			{ label: 'Keyboard heat map', href: '/typing-analysis/' },
		],
	},
	{
		heading: 'Learn & practice',
		links: [
			{ label: 'Learn touch typing', href: '/learn-typing/' },
			{ label: 'Typing lessons', href: '/typing-lessons/' },
			{ label: 'Home row practice', href: '/typing-lessons/home-row/' },
			{ label: 'Typing practice', href: '/typing-practice/' },
			{ label: 'Paragraph practice', href: '/typing-practice/paragraphs/' },
			{ label: 'Number practice', href: '/typing-practice/numbers/' },
			{ label: 'Punctuation practice', href: '/typing-practice/punctuation/' },
		],
	},
	{
		heading: 'keysprint',
		links: [
			{ label: 'About', href: '/about/' },
			{ label: 'Contact', href: '/contact/' },
			{ label: 'Privacy policy', href: '/privacy-policy/' },
			{ label: 'Terms of use', href: '/terms/' },
		],
	},
] as const;
