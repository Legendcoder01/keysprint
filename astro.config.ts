import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

/**
 * Fallback production origin.
 *
 * The site is deployed as a GitHub Pages project site at
 * `https://<owner>.github.io/keysprint/`. Override `SITE_URL` when deploying
 * somewhere else (a custom domain or another static host), and set `BASE_PATH`
 * to the path the site is served from (`/` for a domain root).
 */
const DEFAULT_SITE_URL = 'https://legendcoder01.github.io';
const DEFAULT_BASE_PATH = '/keysprint';

// Astro evaluates the config file before it loads `.env` files, so they have to
// be read explicitly here. `process.env.NODE_ENV` is set by the Astro CLI
// ("development" for `astro dev`, "production" for `astro build`).
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const env = loadEnv(mode, process.cwd(), '');
const site = (env.SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');

const isProduction = process.env.NODE_ENV === 'production';
const requestedBase = env.BASE_PATH || process.env.BASE_PATH;
const base = normalizeBase(requestedBase || (isProduction ? DEFAULT_BASE_PATH : '/'));

function normalizeBase(value: string): string {
	const trimmed = value.trim();
	if (!trimmed || trimmed === '/') return '/';
	return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

/** Walk a directory and return every file path below it. */
async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(full)));
		else files.push(full);
	}
	return files;
}

/**
 * Prefix author-written root-relative links in the built HTML.
 *
 * Astro's `base` prefixes the assets it generates, but not `<a href="/...">`
 * written by hand. Rewriting the finished HTML keeps the source natural and
 * gives `check-dist.mjs` a single place to verify the result. The replacement
 * is idempotent: a path that already starts with the base is left alone.
 */
function basePathIntegration(basePath: string): AstroIntegration {
	return {
		name: 'keysprint-base-path',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				if (basePath === '/') return;

				const root = fileURLToPath(dir);
				const files = (await walk(root)).filter((file) => file.endsWith('.html'));
				let changed = 0;

				for (const file of files) {
					const html = await readFile(file, 'utf8');
					const rewritten = html.replace(
						/(\s)(href|src|action|poster)="(\/[^"]*)"/g,
						(match, space: string, attribute: string, url: string) => {
							if (url.startsWith('//')) return match;
							if (url === basePath || url.startsWith(`${basePath}/`)) return match;
							const next = url === '/' ? `${basePath}/` : `${basePath}${url}`;
							return `${space}${attribute}="${next}"`;
						},
					);

					if (rewritten !== html) {
						await writeFile(file, rewritten);
						changed += 1;
					}
				}

				logger.info(`Prefixed internal links with ${basePath} in ${changed} HTML file(s).`);
			},
		},
	};
}

export default defineConfig({
	site,
	base,
	output: 'static',
	trailingSlash: 'always',
	integrations: [sitemap(), basePathIntegration(base)],
	vite: {
		plugins: [tailwindcss()],
	},
});
