import type { APIRoute } from 'astro';
import { getAllPosts, getSiteSettings } from '../lib/sanity';

/** Escapes the five characters XML cannot carry raw. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://blog.punhelabs.io.vn');
  const [settings, posts] = await Promise.all([getSiteSettings(), getAllPosts()]);

  const items = posts
    .map((post) => {
      const url = new URL(`/posts/${post.slug}/`, base).href;
      return `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      ${post.excerpt ? `<description>${xml(post.excerpt)}</description>` : ''}
${post.tags.map((tag) => `      <category>${xml(tag.name)}</category>`).join('\n')}
    </item>`.replace(/^\s*$\n/gm, '');
    })
    .join('\n');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(settings.title)}</title>
    <link>${xml(base.href)}</link>
    <description>${xml(settings.introCallout ?? settings.title)}</description>
    <language>vi</language>
    <atom:link href="${xml(new URL('/rss.xml', base).href)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(feed, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
