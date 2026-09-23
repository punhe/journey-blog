import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  getAllPosts,
  getPostBySlug,
  getPostsByTag,
  getSiteSettings,
  imageFor,
} from '../src/lib/sanity';
import type { Post, PostSummary, SiteSettings } from '../src/lib/types';
import { fetchMock } from './mocks/sanity-client';

const coverImage = {
  _type: 'image' as const,
  asset: { _ref: 'image-abc123-1200x800-jpg', _type: 'reference' as const },
};

const postFixture: PostSummary = {
  _id: 'post-1',
  title: 'Một ngày ở Đà Lạt',
  slug: 'mot-ngay-o-da-lat',
  emoji: '🌫️',
  coverImage,
  excerpt: 'Sương, cà phê, và một buổi sáng chậm.',
  publishedAt: '2026-03-04T09:00:00.000Z',
  seriesNumber: 2,
  tags: [{ _id: 'tag-1', name: 'Travel', slug: 'travel', emoji: '✈️', color: 'blue' }],
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe('post queries', () => {
  it('returns the summary shape for the post list', async () => {
    fetchMock.mockResolvedValue([postFixture]);

    const posts = await getAllPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: 'mot-ngay-o-da-lat',
      title: 'Một ngày ở Đà Lạt',
      seriesNumber: 2,
    });
    expect(posts[0]!.tags[0]!.color).toBe('blue');
  });

  it('orders the list by publish date, newest first, and skips drafts', async () => {
    fetchMock.mockResolvedValue([]);

    await getAllPosts();

    const [query] = fetchMock.mock.calls[0]!;
    expect(query).toContain('order(publishedAt desc)');
    expect(query).toContain('!(_id in path("drafts.**"))');
  });

  it('passes the slug as a query parameter, not as string concatenation', async () => {
    const post: Post = { ...postFixture, body: [] };
    fetchMock.mockResolvedValue(post);

    await getPostBySlug('mot-ngay-o-da-lat');

    const [query, params] = fetchMock.mock.calls[0]!;
    expect(params).toEqual({ slug: 'mot-ngay-o-da-lat' });
    expect(query).toContain('slug.current == $slug');
  });

  it('returns null for a slug with no published post', async () => {
    fetchMock.mockResolvedValue(null);

    await expect(getPostBySlug('nope')).resolves.toBeNull();
  });

  it('filters by a tag reference', async () => {
    fetchMock.mockResolvedValue([postFixture]);

    const posts = await getPostsByTag('travel');

    const [query, params] = fetchMock.mock.calls[0]!;
    expect(params).toEqual({ tagSlug: 'travel' });
    expect(query).toContain('tags[]->slug.current');
    expect(posts[0]!.slug).toBe('mot-ngay-o-da-lat');
  });

  it('lets a failed fetch reach the caller so the build stops', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(getAllPosts()).rejects.toThrow('network down');
  });
});

describe('site settings', () => {
  it('returns the stored settings', async () => {
    const settings: SiteSettings = { title: 'My Journal Blog', introCallout: 'Chào xìn.' };
    fetchMock.mockResolvedValue(settings);

    await expect(getSiteSettings()).resolves.toMatchObject(settings);
  });

  it('falls back to a default title and warns when the singleton is missing', async () => {
    fetchMock.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const settings = await getSiteSettings();

    expect(settings).toEqual({ title: 'My Journal Blog' });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('imageFor', () => {
  it('builds a Sanity CDN url', () => {
    const url = imageFor(coverImage)?.width(760).height(500).url();

    expect(url).toContain('cdn.sanity.io/images/testproj/production/abc123-1200x800.jpg');
    expect(url).toContain('w=760');
    expect(url).toContain('h=500');
  });

  it('returns null when there is no image, so callers can draw a placeholder', () => {
    expect(imageFor(undefined)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats as "Month D, YYYY" in UTC', () => {
    expect(formatDate('2026-03-04T09:00:00.000Z')).toBe('March 4, 2026');
  });
});
