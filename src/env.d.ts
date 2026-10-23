/// <reference types="astro/client" />

interface ImportMetaEnv {
	/**
	 * Production origin for canonical URLs, Open Graph / Twitter card URLs and the
	 * XML sitemap. Falls back to the GitHub Pages origin when unset.
	 */
	readonly SITE_URL?: string;
	/** Path the site is served from, e.g. `/keysprint`. Defaults to `/`. */
	readonly BASE_PATH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
