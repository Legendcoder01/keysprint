import type { APIRoute } from 'astro';
import { SITE_URL } from '../config/site';

/**
 * robots.txt
 *
 * Generated as a route rather than a static file so the sitemap address always
 * matches the configured origin. Changing `SITE_URL` changes the sitemap, the
 * canonical tags and this file together, with no second place to update.
 */
export const GET: APIRoute = () => {
	const body = [
		'User-agent: *',
		'Allow: /',
		'',
		`Sitemap: ${SITE_URL}/sitemap-index.xml`,
		'',
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
