/**
 * Base-path helpers.
 *
 * The production site is a GitHub Pages **project site**, served from
 * `https://<owner>.github.io/keysprint/` rather than from a domain root. Astro
 * prefixes the asset URLs it generates, but it deliberately leaves author
 * written links alone. Every internal link and runtime asset URL therefore goes
 * through the helpers here, and a build hook rewrites the remaining static
 * markup (see `astro.config.ts`).
 */

const RAW_BASE = import.meta.env.BASE_URL || '/';

/** Normalise Vite's base into `/keysprint` (never `/keysprint/`), or `/`. */
export function normalizeBase(value: string): string {
	const trimmed = value.trim();
	if (!trimmed || trimmed === '/') return '/';
	return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

/** The site's base path, without a trailing slash. `/` for a root deployment. */
export const BASE_PATH = normalizeBase(RAW_BASE);

/**
 * Prefix a site-relative path with the base path.
 *
 * Absolute URLs, protocol-relative URLs and fragment-only links are left alone,
 * and an already-prefixed path is returned unchanged so the function is safe to
 * apply more than once.
 */
export function withBase(path: string): string {
	if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(path)) return path;

	const normalized = path.startsWith('/') ? path : `/${path}`;
	if (BASE_PATH === '/') return normalized;
	if (normalized === BASE_PATH) return `${BASE_PATH}/`;
	if (normalized.startsWith(`${BASE_PATH}/`)) return normalized;
	return normalized === '/' ? `${BASE_PATH}/` : `${BASE_PATH}${normalized}`;
}

/** Remove the base path from a URL pathname. */
export function stripBase(pathname: string): string {
	if (BASE_PATH === '/') return pathname;
	if (pathname === BASE_PATH) return '/';
	if (pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length) || '/';
	return pathname;
}
