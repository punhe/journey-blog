/**
 * One-time placeholder content for a fresh dataset:
 * 1 siteSettings, 6 tags, 6 posts, each with a generated cover.
 *
 *   npm run seed            create anything that is missing
 *   npm run seed -- --force overwrite the seeded documents and re-upload covers
 *
 * Needs SANITY_API_TOKEN with the Editor role. Replace this content with your
 * own in the Studio; nothing here is referenced by the site code.
 */

import { createClient } from '@sanity/client';
import { Canvas, hex, type RGB } from './lib/png';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: fall back to the ambient environment.
}

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET ?? 'production';
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error(
    'Set PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN first. ' +
      'Copy .env.example to .env and fill it in.',
  );
  process.exit(1);
}

const force = process.argv.includes('--force');

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2026-01-01',
  useCdn: false,
});

/* ------------------------------------------------------------------ art -- */

interface Palette {
  sky: [string, string];
  far: string;
  near: string;
  accent: string;
}

const PALETTES: Palette[] = [
  { sky: ['#2b3a45', '#6d7f7a'], far: '#3f5150', near: '#26332f', accent: '#e4b97c' },
  { sky: ['#3a2f3f', '#8a6f78'], far: '#59434c', near: '#332730', accent: '#d9a9a0' },
  { sky: ['#243447', '#5f7b8c'], far: '#3a4f5e', near: '#22313a', accent: '#8fbfa6' },
  { sky: ['#402f28', '#9b7a55'], far: '#604733', near: '#372a22', accent: '#e8cf9a' },
  { sky: ['#2c3a30', '#7d8f6a'], far: '#45573f', near: '#283127', accent: '#cfd9a0' },
  { sky: ['#332b44', '#7a6c96'], far: '#4a3f60', near: '#2a2438', accent: '#b49ed6' },
];

/** A horizon, two ridges and one disc: enough to read as an illustration. */
function landscape(width: number, height: number, palette: Palette, phase: number): Buffer {
  const canvas = new Canvas(width, height);
  canvas.gradient(hex(palette.sky[0]), hex(palette.sky[1]));
  canvas.disc(width * 0.72, height * 0.34, Math.min(width, height) * 0.11, hex(palette.accent));
  canvas.ridge(hex(palette.far), height * 0.62, height * 0.09, 1.1, phase);
  canvas.ridge(hex(palette.near), height * 0.82, height * 0.06, 1.7, phase + 2.1);
  canvas.grain();
  return canvas.toPng();
}

function portrait(width: number, height: number): Buffer {
  const canvas = new Canvas(width, height);
  canvas.gradient(hex('#2b2620'), hex('#1a1613'));
  const skin: RGB = hex('#c9a483');
  canvas.disc(width * 0.5, height * 0.38, width * 0.2, skin);
  canvas.ridge(hex('#4a5f55'), height * 0.66, height * 0.1, 0.5, 3.6); // shoulders
  canvas.grain(3);
  return canvas.toPng();
}

async function uploadImage(filename: string, png: Buffer) {
  const asset = await client.assets.upload('image', png, {
    filename,
    contentType: 'image/png',
  });
  return { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: asset._id } };
}

/* -------------------------------------------------------------- content -- */

const TAGS = [
  { id: 'tag-dev-notes', name: 'Dev Notes', slug: 'dev-notes', emoji: '💻', color: 'blue' },
  { id: 'tag-ai-tooling', name: 'AI & Tooling', slug: 'ai-tooling', emoji: '🤖', color: 'purple' },
  { id: 'tag-career-talk', name: 'Career Talk', slug: 'career-talk', emoji: '💼', color: 'brown' },
  { id: 'tag-travel', name: 'Travel', slug: 'travel', emoji: '✈️', color: 'green' },
  { id: 'tag-life-style', name: 'Life style', slug: 'life-style', emoji: '🍵', color: 'red' },
  {
    id: 'tag-self-reflection',
    name: 'Self Reflection',
    slug: 'self-reflection',
    emoji: '🌙',
    color: 'gray',
  },
] as const;

type BodyItem = { p: string } | { h2: string } | { code: string; lang: string };

interface SeedPost {
  id: string;
  title: string;
  slug: string;
  emoji: string;
  excerpt: string;
  publishedAt: string;
  seriesNumber?: number;
  tags: string[];
  body: BodyItem[];
}

const POSTS: SeedPost[] = [
  {
    id: 'post-astro-sanity',
    title: 'Dựng blog tĩnh bằng Astro và Sanity',
    slug: 'dung-blog-tinh-bang-astro-va-sanity',
    emoji: '🧱',
    excerpt: 'Một site tĩnh, một CMS có giao diện, và không có server nào phải trông.',
    publishedAt: '2026-09-18T02:00:00.000Z',
    tags: ['tag-dev-notes'],
    body: [
      {
        p: 'Tôi muốn viết blog mà không phải nuôi server, nhưng vẫn sửa bài được từ điện thoại. Astro lo phần tĩnh, Sanity lo phần nội dung, thế là đủ.',
      },
      {
        p: 'Toàn bộ nội dung đọc ở lúc build. Không có request nào chạy về CMS khi người đọc mở trang, nên trang chỉ là HTML và ảnh.',
      },
      { h2: 'Nối hai thứ lại' },
      {
        p: 'Integration @sanity/astro tiêm sẵn một module tên sanity:client, và gắn luôn Studio vào một route trong cùng site.',
      },
      {
        lang: 'js',
        code: `import sanity from '@sanity/astro';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
      dataset: 'production',
      useCdn: true,
      studioBasePath: '/studio',
    }),
  ],
});`,
      },
      { h2: 'Query thì viết bằng GROQ' },
      {
        p: 'GROQ đọc lạ mắt lúc đầu nhưng gọn hơn GraphQL cho việc này. Một điểm phải nhớ: lọc bản nháp ra, nếu không bài chưa xong cũng lên site.',
      },
      {
        lang: 'groq',
        code: `*[_type == "post" && !(_id in path("drafts.**"))]
  | order(publishedAt desc) {
    title,
    "slug": slug.current,
    publishedAt,
    "tags": tags[]->{ name, "slug": slug.current, color }
  }`,
      },
      {
        p: 'Còn lại là chuyện bình thường: build ra thư mục tĩnh, đẩy lên hosting, xong.',
      },
    ],
  },
  {
    id: 'post-netlify-blobs',
    title: 'Đếm lượt xem bằng Netlify Blobs',
    slug: 'dem-luot-xem-bang-netlify-blobs',
    emoji: '🔢',
    excerpt: 'Không cần database. Một function, một key-value store, và chấp nhận đếm sai một chút.',
    publishedAt: '2026-09-09T08:30:00.000Z',
    tags: ['tag-dev-notes'],
    body: [
      {
        p: 'Site tĩnh thì không có chỗ nào giữ số lượt xem. Tôi không muốn dựng database chỉ để đếm, nên dùng Netlify Blobs: một key-value store đi kèm sẵn, key là slug, value là con số.',
      },
      { h2: 'Cả function chỉ có bấy nhiêu' },
      {
        lang: 'ts',
        code: `import { getStore } from '@netlify/blobs';

export default async function handler(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug || !/^[a-z0-9-]{1,120}$/.test(slug)) {
    return Response.json({ error: 'bad slug' }, { status: 400 });
  }

  const store = getStore('post-views');
  const current = Number(await store.get(slug, { type: 'text' })) || 0;
  const next = current + 1;
  await store.set(slug, String(next));

  return Response.json({ views: { [slug]: next } });
}`,
      },
      { h2: 'Chỗ này đếm sai, và tôi chấp nhận' },
      {
        p: 'Đoạn tăng số là đọc rồi ghi. Blobs không có compare-and-set, nên hai request chồng nhau có thể cùng đọc ra một số và mất một lượt. Với blog cá nhân thì sai một lượt không đổi được gì, còn dựng database để đếm chính xác thì không đáng.',
      },
      {
        p: 'Thứ tôi quan tâm hơn là lúc store chết. Function trả về 200 kèm views: null, và giao diện giấu luôn con số thay vì hiện 0. Hiện 0 là nói dối; giấu đi là im lặng, đỡ hơn.',
      },
    ],
  },
  {
    id: 'post-ai-viet-nhap',
    title: 'Để AI viết nháp, mình biên tập',
    slug: 'de-ai-viet-nhap-minh-bien-tap',
    emoji: '🤖',
    excerpt: 'MCP cho agent ghi thẳng vào CMS. Phần hay nằm ở chỗ nó chỉ được ghi bản nháp.',
    publishedAt: '2026-08-26T10:00:00.000Z',
    tags: ['tag-ai-tooling', 'tag-career-talk'],
    body: [
      {
        p: 'Sanity có sẵn một MCP server. Khai báo vào config là agent đọc ghi được document trong dataset, không cần tôi viết wrapper.',
      },
      {
        lang: 'json',
        code: `{
  "mcpServers": {
    "sanity": {
      "command": "npx",
      "args": ["-y", "@sanity/mcp-server@latest"],
      "env": {
        "SANITY_PROJECT_ID": "your_project_id",
        "SANITY_DATASET": "production",
        "SANITY_API_TOKEN": "your_editor_token",
        "MCP_USER_ROLE": "editor"
      }
    }
  }
}`,
      },
      { h2: 'Quy trình tôi thấy ổn' },
      {
        p: 'Agent tạo bài ở dạng nháp. Tôi mở Studio đọc, sửa chỗ nào sai giọng, rồi bấm publish. Bản nháp không bao giờ lên site vì query đã lọc sẵn, nên không sợ bài nửa vời lọt ra ngoài.',
      },
      {
        p: 'Tôi không để nó publish thẳng. Không phải vì nó viết dở, mà vì bài trên blog này là tôi nói, và việc đọc lại một lượt trước khi nói là chuyện nên làm.',
      },
      {
        p: 'Một lưu ý thật: token trong file config là token có quyền ghi. Đừng commit nó, và đừng dán nó vào khung chat nào.',
      },
    ],
  },
  {
    id: 'post-da-lat',
    title: 'Một buổi sáng chậm ở Đà Lạt',
    slug: 'mot-buoi-sang-cham-o-da-lat',
    emoji: '🌫️',
    excerpt: 'Sương chưa tan, quán chưa mở, và tôi không vội đi đâu cả.',
    publishedAt: '2026-08-14T01:00:00.000Z',
    seriesNumber: 1,
    tags: ['tag-travel', 'tag-life-style'],
    body: [
      {
        p: 'Tôi dậy lúc năm giờ, không phải vì chăm chỉ mà vì lạnh. Cái lạnh ở đây không gắt, nó chỉ đủ để kéo người ta ra khỏi chăn rồi đẩy ra ngoài hiên.',
      },
      {
        p: 'Quán cà phê đầu dốc sáu giờ mới mở. Tôi ngồi chờ trên bậc thềm, nghe tiếng xe máy đầu tiên của ngày đi ngang, và nhận ra mình đã lâu không chờ đợi thứ gì mà không mở điện thoại.',
      },
      { h2: 'Không lên lịch' },
      {
        p: 'Chuyến đi này tôi không đặt trước gì cả. Không có danh sách chỗ phải tới, không có ảnh phải chụp. Hoá ra thứ tôi cần không phải là một nơi khác, mà là một tốc độ khác.',
      },
    ],
  },
  {
    id: 'post-cafe-sang',
    title: 'Pha cà phê như một cái cớ',
    slug: 'pha-ca-phe-nhu-mot-cai-co',
    emoji: '☕',
    excerpt: 'Mười phút mỗi sáng để làm một việc duy nhất, từ đầu đến cuối.',
    publishedAt: '2026-07-28T02:30:00.000Z',
    seriesNumber: 2,
    tags: ['tag-life-style', 'tag-self-reflection'],
    body: [
      {
        p: 'Tôi không phải người sành cà phê. Tôi chỉ thích cái khoảng mười phút mà trong đó mình chỉ làm đúng một việc: cân, xay, rót, chờ.',
      },
      {
        p: 'Công việc của tôi gần như không có việc nào kết thúc gọn ghẽ trong một buổi. Ticket nối ticket, review nối review. Cốc cà phê thì có. Nó bắt đầu và nó xong.',
      },
      { p: 'Có hôm pha hỏng. Cũng không sao, vì hỏng cũng là một kết thúc rõ ràng.' },
    ],
  },
  {
    id: 'post-tau-dem',
    title: 'Chuyến tàu đêm ra Bắc',
    slug: 'chuyen-tau-dem-ra-bac',
    emoji: '🚃',
    excerpt: 'Mười hai tiếng không sóng, và một cuộc nói chuyện với người lạ.',
    publishedAt: '2026-07-05T22:10:00.000Z',
    seriesNumber: 3,
    tags: ['tag-travel', 'tag-self-reflection'],
    body: [
      { p: 'Tàu chạy lúc bảy giờ tối. Đến chín giờ thì hết sóng, và đó là phần tôi mong nhất.' },
      {
        p: 'Bác ngồi đối diện đi thăm con gái mới sinh. Bác kể suốt hai tiếng, tôi nghe suốt hai tiếng, và không lần nào phải nghĩ xem mình nên nói gì cho hay.',
      },
      { p: 'Sáng ra, bác xuống trước tôi một ga. Chúng tôi không hỏi tên nhau.' },
    ],
  },
];

const ABOUT: BodyItem[] = [
  { p: 'Chào xìn. Tôi viết ở đây vào những buổi tối không có việc gấp.' },
  {
    p: 'Chỗ này có hai loại bài. Một là ghi chép kỹ thuật: thứ tôi vừa dựng, thứ vừa hỏng, và lý do tôi chọn cách này thay vì cách kia. Hai là chuyện đi, chuyện làm, chuyện nghĩ lung tung, ghi lại trước khi quên.',
  },
];

/* ----------------------------------------------------------------- run --- */

function toPortableText(items: BodyItem[], prefix: string) {
  return items.map((item, index) => {
    const _key = `${prefix}-${index}`;

    if ('code' in item) {
      return { _type: 'code', _key, language: item.lang, code: item.code };
    }

    const heading = 'h2' in item;
    return {
      _type: 'block',
      _key,
      style: heading ? 'h2' : 'normal',
      markDefs: [],
      children: [
        { _type: 'span', _key: `${_key}-0`, text: heading ? item.h2 : item.p, marks: [] },
      ],
    };
  });
}

async function main() {
  const existing = await client.fetch<number>('count(*[_type == "post"])');
  if (existing > 0 && !force) {
    console.log(`Dataset already has ${existing} post(s). Nothing done. Use --force to overwrite.`);
    return;
  }

  console.log('Drawing placeholder images…');
  const banner = await uploadImage('journal-banner.png', landscape(2000, 700, PALETTES[2]!, 0.4));
  const about = await uploadImage('journal-portrait.png', portrait(640, 800));
  const covers = await Promise.all(
    POSTS.map((post, index) =>
      uploadImage(`${post.slug}.png`, landscape(1200, 800, PALETTES[index]!, index * 1.3)),
    ),
  );
  console.log(`Uploaded ${covers.length + 2} images.`);

  const tx = client.transaction();

  tx.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    title: 'My Journal Blog',
    bannerImage: { ...banner, alt: 'Đồi và sương lúc sớm' },
    introCallout:
      'Ghi chép kỹ thuật và những ngày bình thường. Thứ tôi vừa dựng, thứ vừa hỏng, và chuyện ngoài màn hình.',
    aboutImage: { ...about, alt: 'Chân dung tác giả' },
    aboutBody: toPortableText(ABOUT, 'about'),
  });

  for (const tag of TAGS) {
    tx.createOrReplace({
      _id: tag.id,
      _type: 'tag',
      name: tag.name,
      slug: { _type: 'slug', current: tag.slug },
      emoji: tag.emoji,
      color: tag.color,
    });
  }

  POSTS.forEach((post, index) => {
    tx.createOrReplace({
      _id: post.id,
      _type: 'post',
      title: post.title,
      slug: { _type: 'slug', current: post.slug },
      emoji: post.emoji,
      coverImage: { ...covers[index]!, alt: post.title },
      excerpt: post.excerpt,
      publishedAt: post.publishedAt,
      ...(post.seriesNumber ? { seriesNumber: post.seriesNumber } : {}),
      tags: post.tags.map((id) => ({ _type: 'reference', _ref: id, _key: `${post.id}-${id}` })),
      body: toPortableText(post.body, post.id),
    });
  });

  await tx.commit();
  console.log(`Seeded 1 siteSettings, ${TAGS.length} tags and ${POSTS.length} posts.`);
  console.log('Open /studio to edit them.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
