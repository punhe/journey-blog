import type { APIRoute } from 'astro';
import { formatDate, getAllPosts, getAllTags, getSiteSettings } from '../lib/sanity';

/**
 * llms.txt: one plain-text page that tells an assistant what lives here and
 * where, without making it crawl and guess. The convention is a Markdown file
 * of links with one-line summaries.
 */
export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://blog.punhelabs.io.vn');
  const [settings, posts, tags] = await Promise.all([
    getSiteSettings(),
    getAllPosts(),
    getAllTags(),
  ]);

  const author = settings.authorName || settings.title;

  const lines = [
    `# ${settings.title}`,
    '',
    `> ${settings.introCallout ?? 'Ghi chép kỹ thuật và chuyện thường ngày.'}`,
    '',
    `Tác giả: ${author}. Ngôn ngữ: tiếng Việt. Nguồn: ${base.href}`,
    '',
    'Nội dung được phép trích dẫn kèm đường dẫn về bài gốc.',
    '',
    '## Bài viết',
    '',
  ];

  for (const post of posts) {
    const url = new URL(`/posts/${post.slug}/`, base).href;
    const summary = post.excerpt ?? '';
    const tagNames = post.tags.map((tag) => tag.name).join(', ');
    lines.push(`- [${post.title}](${url})`);
    if (summary) lines.push(`  ${summary}`);
    lines.push(`  Đăng ${formatDate(post.publishedAt)}${tagNames ? `. Thẻ: ${tagNames}` : ''}`);
  }

  lines.push('', '## Thẻ', '');
  for (const tag of tags) {
    lines.push(`- [${tag.name}](${new URL(`/tags/${tag.slug}/`, base).href})`);
  }

  lines.push('', '## Khác', '', `- [Nguồn cấp RSS](${new URL('/rss.xml', base).href})`, '');

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
