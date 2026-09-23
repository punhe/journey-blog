/** Shapes returned by the GROQ queries in `sanity.ts`. */

export type TagColor = 'blue' | 'green' | 'brown' | 'purple' | 'red' | 'gray';

export interface SanityImage {
  _type: 'image';
  asset: { _ref: string; _type: 'reference' };
  hotspot?: { x: number; y: number; width: number; height: number };
  crop?: { top: number; bottom: number; left: number; right: number };
  alt?: string;
  caption?: string;
}

/** One Portable Text member: a text block, an image, or a code object. */
export interface PortableTextSpan {
  _type: 'span';
  _key: string;
  text: string;
  marks?: string[];
}

export interface PortableTextMarkDef {
  _type: string;
  _key: string;
  href?: string;
}

export interface PortableTextBlock {
  _type: 'block';
  _key: string;
  style?: 'normal' | 'h2' | 'h3' | 'blockquote';
  listItem?: 'bullet' | 'number';
  level?: number;
  children: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
}

export interface PortableTextCode {
  _type: 'code';
  _key: string;
  language?: string;
  code?: string;
}

export type PortableTextImage = SanityImage & { _key: string };

export type PortableTextNode = PortableTextBlock | PortableTextImage | PortableTextCode;

export interface Tag {
  _id: string;
  name: string;
  slug: string;
  color: TagColor;
}

export interface PostSummary {
  _id: string;
  title: string;
  slug: string;
  coverImage?: SanityImage;
  excerpt?: string;
  publishedAt: string;
  seriesNumber?: number;
  tags: Tag[];
}

export interface Post extends PostSummary {
  body: PortableTextNode[];
}

export interface SiteSettings {
  title: string;
  authorName?: string;
  bannerImage?: SanityImage;
  introCallout?: string;
  aboutImage?: SanityImage;
  aboutBody?: PortableTextNode[];
}
