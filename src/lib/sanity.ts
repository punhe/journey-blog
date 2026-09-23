import { createImageUrlBuilder, type ImageUrlBuilder } from '@sanity/image-url';
import { sanityClient } from 'sanity:client';
import type { Post, PostSummary, SanityImage, SiteSettings, Tag } from './types';

/**
 * All reads run at build time against published documents only.
 * A failure here is not caught: a broken fetch must fail the build rather
 * than publish a site with silently missing posts (spec section 9).
 */

const POST_SUMMARY_FIELDS = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  emoji,
  coverImage,
  excerpt,
  publishedAt,
  seriesNumber,
  "tags": coalesce(
    tags[]->{ _id, name, "slug": slug.current, emoji, color },
    []
  )
`;

const PUBLISHED = /* groq */ `_type == "post" && !(_id in path("drafts.**")) && defined(slug.current)`;

export async function getAllPosts(): Promise<PostSummary[]> {
  return sanityClient.fetch<PostSummary[]>(
    /* groq */ `*[${PUBLISHED}] | order(publishedAt desc) { ${POST_SUMMARY_FIELDS} }`,
  );
}

export async function getPostSlugs(): Promise<string[]> {
  return sanityClient.fetch<string[]>(/* groq */ `*[${PUBLISHED}].slug.current`);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return sanityClient.fetch<Post | null>(
    /* groq */ `*[${PUBLISHED} && slug.current == $slug][0] { ${POST_SUMMARY_FIELDS}, body }`,
    { slug },
  );
}

export async function getPostsByTag(tagSlug: string): Promise<PostSummary[]> {
  return sanityClient.fetch<PostSummary[]>(
    /* groq */ `*[${PUBLISHED} && $tagSlug in tags[]->slug.current]
      | order(publishedAt desc) { ${POST_SUMMARY_FIELDS} }`,
    { tagSlug },
  );
}

export async function getAllTags(): Promise<Tag[]> {
  return sanityClient.fetch<Tag[]>(
    /* groq */ `*[_type == "tag" && defined(slug.current)] | order(name asc) {
      _id, name, "slug": slug.current, emoji, color
    }`,
  );
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  return sanityClient.fetch<Tag | null>(
    /* groq */ `*[_type == "tag" && slug.current == $slug][0] {
      _id, name, "slug": slug.current, emoji, color
    }`,
    { slug },
  );
}

const FALLBACK_SETTINGS: SiteSettings = { title: 'My Journal Blog' };

/**
 * Returns hard-coded defaults when the singleton has not been created yet,
 * so a fresh dataset still builds. The warning shows up in the build log.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await sanityClient.fetch<SiteSettings | null>(
    /* groq */ `*[_type == "siteSettings" && !(_id in path("drafts.**"))][0] {
      title, authorName, bannerImage, introCallout, aboutImage, aboutBody
    }`,
  );

  if (!settings) {
    console.warn(
      '[sanity] No siteSettings document found. Using the fallback title and empty ' +
        'banner, intro and about sections. Create it in the Studio at /studio.',
    );
    return FALLBACK_SETTINGS;
  }

  return { ...FALLBACK_SETTINGS, ...settings };
}

const builder = createImageUrlBuilder(sanityClient);

/** Returns null when the image is absent, so callers can render a placeholder. */
export function imageFor(source: SanityImage | undefined | null): ImageUrlBuilder | null {
  if (!source?.asset?._ref) return null;
  return builder.image(source).auto('format').fit('crop');
}

/** "March 4, 2026": the date format the reference site uses. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
