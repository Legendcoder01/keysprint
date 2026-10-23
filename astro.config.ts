import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

/**
 * Fallback production origin.
 *
 * keysprint is deployed as a static site on Render's free tier, which serves the
 * built `dist/` directory from `https://<service-name>.onrender.com`. Override
 * this with a `SITE_URL` environment variable (see `.env.example`) as soon as a
 * custom domain is attached, so canonical tags, Open Graph URLs and the XML
 * sitemap all point at the live host.
 */
const DEFAULT_SITE_URL = 'https://keysprint.onrender.com';

// Astro evaluates the config file before it loads `.env` files, so they have to
// be read explicitly here. `process.env.NODE_ENV` is set by the Astro CLI
// ("development" for `astro dev`, "production" for `astro build`).
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const env = loadEnv(mode, process.cwd(), '');
const site = (env.SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');

export default defineConfig({
	site,
	output: 'static',
	trailingSlash: 'always',
	integrations: [sitemap()],
	vite: {
		plugins: [tailwindcss()],
	},
});
