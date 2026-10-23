/// <reference types="astro/client" />

interface ImportMetaEnv {
	/**
	 * Production origin for canonical URLs, Open Graph / Twitter card URLs and the
	 * XML sitemap. Falls back to the Render default when unset.
	 */
	readonly SITE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
