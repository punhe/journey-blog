# Journal Blog — Design Spec

Date: 2026-09-21
Status: Approved for planning

## 1. Goal

Build a personal journal blog modeled on the reference Notion site
(https://impartial-net-2d6.notion.site/My-Journal-Blog-e0ff00c5b71f4a958185bd312df129c5):
a dark, minimal, illustration-led blog with a post grid, tag filtering,
an about section, and long-form article pages.

Additional requirements beyond the reference:

- Content lives in a headless CMS (Sanity) with a web UI (Sanity Studio) to edit posts.
- An AI agent can create, edit, and publish posts through MCP.
- Each post records and displays a view count.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Frontend | Astro (static output) | `@sanity/astro` integration |
| Hosting | Netlify | one site, one deploy |
| CMS | Sanity | free tier; Studio embedded at `/studio` |
| AI posting | Official `@sanity/mcp-server` | configured in Claude Code / Claude Desktop |
| View counter | Netlify Function + Netlify Blobs | key = post slug, value = integer |
| Rebuild trigger | Sanity webhook → Netlify build hook | fires on post publish/unpublish |
| Package manager | npm | |
| Language | TypeScript | |

Rejected alternatives (recorded for context):

- Separate Studio deploy on `sanity.studio`: two deploys, two configs; no benefit for one author.
- Custom MCP wrapper: only needed if Sanity MCP cannot express a policy (e.g. AI may only create drafts). Defer.
- View counts stored in Sanity: costs one write API call per view; slower; not needed in Studio.

## 3. Repository layout

```
E:\StartUp\blog\
├── astro.config.mjs
├── sanity.config.ts            Studio config (schemas, project id, dataset)
├── sanity.cli.ts
├── netlify.toml
├── package.json
├── tsconfig.json
├── .env.example                PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, SANITY_API_TOKEN (seed only)
├── .mcp.json.example           Sanity MCP config for Claude Code
├── README.md                   setup, MCP, webhook steps
├── scripts/seed.ts             one-time placeholder content seeder
├── src/
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro         home
│   │   ├── posts/[slug].astro  article page
│   │   └── tags/[slug].astro   posts filtered by one tag
│   ├── components/
│   │   ├── Header.astro
│   │   ├── HeroBanner.astro
│   │   ├── IntroCallout.astro
│   │   ├── PostGrid.astro
│   │   ├── PostCard.astro
│   │   ├── TagChip.astro
│   │   ├── TagFilterTabs.astro
│   │   ├── ViewCount.astro     island: fetches /api/views client-side
│   │   ├── PortableText.astro  renders body blocks
│   │   └── AboutSection.astro
│   ├── lib/
│   │   ├── sanity.ts           client + GROQ queries
│   │   └── types.ts            Post, Tag, SiteSettings
│   └── styles/global.css       design tokens, dark theme
├── sanity/
│   └── schemas/
│       ├── index.ts
│       ├── post.ts
│       ├── tag.ts
│       └── siteSettings.ts
├── netlify/
│   └── functions/
│       └── views.ts            GET count / POST increment
└── docs/superpowers/specs/     this file
```

## 4. Data model (Sanity)

### post
| Field | Type | Required | Notes |
|---|---|---|---|
| title | string | yes | |
| slug | slug (from title) | yes | unique |
| emoji | string | no | shown before title, like the reference |
| coverImage | image (hotspot) | yes | card + article header |
| excerpt | text | no | used in meta description |
| publishedAt | datetime | yes | sort key, displayed as "Month D, YYYY" |
| tags | array<reference→tag> | no | |
| body | array (Portable Text) | yes | blocks, image, code |
| seriesNumber | number | no | renders "Kể chuyện #N" label on the card if set |

Draft/published state uses Sanity's native drafts. The frontend reads
only published documents.

### tag
| Field | Type | Required | Notes |
|---|---|---|---|
| name | string | yes | |
| slug | slug | yes | |
| emoji | string | no | |
| color | string (select) | yes | one of a fixed palette: blue, green, brown, purple, red, gray |

### siteSettings (singleton)
| Field | Type | Notes |
|---|---|---|
| title | string | "My Journal Blog" |
| bannerImage | image | wide hero illustration |
| introCallout | text | the highlighted paragraph under the title |
| aboutImage | image | portrait |
| aboutBody | Portable Text | the "Chao xìn" section |

Placeholder content is seeded by a script (`scripts/seed.ts`, run once
with an Editor token): 1 siteSettings, 4 tags (Travel, Life style,
Self Reflection, Career Talk), 6 posts with generated SVG cover
placeholders.

## 5. Pages and behavior

### Home `/`
1. Header: site title (left), nothing else.
2. Hero banner: full-width `bannerImage`.
3. Title + intro callout.
4. Tab row: **All blogs** | **Tags**. "All blogs" shows the grid sorted
   by `publishedAt` desc. "Tags" shows chips for every tag; clicking a
   chip navigates to `/tags/[slug]`. Plain links, no JS state.
5. Post grid: 3 columns at ≥1024px, 2 columns at ≥640px, 1 column below.
   Card = cover image, emoji + title, date, tag chips, view count.
6. About section: portrait left, text right; stacks on mobile.

### Article `/posts/[slug]`
Cover image, emoji + title, tag chips, published date, view count,
Portable Text body, back link to home. Loading the page fires one
POST to the views function; the response value is displayed.

### Tag `/tags/[slug]`
Same grid, filtered to posts that reference the tag. Heading shows the
tag name and emoji.

### Studio `/studio`
Sanity Studio served by `@sanity/astro`. Authenticated by Sanity.

### Not in scope for v1
Search, RSS, comments, newsletter, light/dark toggle, pagination
(the grid renders all posts; revisit past ~60 posts).

## 6. View counter

Netlify Function `netlify/functions/views.ts`:

- `GET /api/views?slug=x` → `{ views: { x: n } }` (0 if absent).
- `GET /api/views?slugs=a,b,c` → `{ views: { a: n, b: n, c: n } }` (max 100 slugs).
- `POST /api/views?slug=x` → increments, returns `{ views: { x: n+1 } }`.
- Store: Netlify Blobs, store name `post-views`, key = slug, value = integer as string.
- Validation: each slug must match `^[a-z0-9-]{1,120}$`; otherwise 400.
- The increment is read-then-write, not atomic across concurrent
  requests (Blobs has no compare-and-set). Acceptable for a personal
  blog; documented in the function header.
- Home cards: one client-side island collects slugs on the page and
  calls the batched GET once after load.
- Article page: one POST on load. Repeat views by the same visitor
  count; no dedupe in v1.
- `netlify.toml` redirects `/api/views` → `/.netlify/functions/views`.

Local development uses `netlify dev`, which provides a local Blobs
emulator.

## 7. AI posting via MCP

- Nothing installed in the repo. `README.md` documents the config for
  Claude Code (`.mcp.json`) and Claude Desktop, pointing at
  `npx -y @sanity/mcp-server@latest` with env
  `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN`
  (token role: Editor).
- The repo ships `.mcp.json.example`. The real `.mcp.json` is
  git-ignored because it holds the token.
- Recommended workflow: AI creates a `post` as a draft, the human
  reviews in Studio and publishes. Publishing triggers the Netlify
  rebuild via webhook.

## 8. Build and deploy

- `npm run dev` → Astro dev server with Studio at `/studio`.
- `netlify dev` → same plus functions and Blobs emulator.
- `npm run build` → static output in `dist/`; Studio is bundled as a
  client-rendered route.
- Netlify: build command `npm run build`, publish `dist`, functions
  `netlify/functions`. Env vars set in Netlify UI.
- Sanity webhook (Manage → API → Webhooks) on `post` create/update/
  delete → Netlify build hook URL. Set up manually; steps in README.

## 9. Error handling

- Sanity fetch fails at build → build fails loudly (no stale silent site).
- Views function: Blobs unavailable → return 200 with `views: null`;
  the UI hides the counter instead of showing 0.
- Missing `siteSettings` document → home renders with a hard-coded
  fallback title and empty sections, and logs a build warning.
- Post with no cover → card shows a neutral placeholder block.

## 10. Testing

- Unit (Vitest): `views.ts` handler — GET absent slug, POST increments,
  invalid slug → 400, batched GET returns map, Blobs failure → `views: null`.
  Blobs mocked.
- Unit: GROQ query helpers return typed shapes against a fixture.
- Build check: `astro check` + `astro build` in CI (Netlify build).
- Manual: open `/`, `/posts/[slug]`, `/tags/[slug]`, `/studio` on the
  deploy preview; confirm the view counter increments on reload.

## 11. Setup steps the user must do

1. Create a Sanity project (`npx sanity@latest init` or sanity.io/manage). Note project ID and dataset.
2. Create an API token with Editor role (for MCP and seeding). Dataset is public, so builds need no token.
3. Create a Netlify site linked to this repo; set env vars.
4. Create a Netlify build hook; paste its URL into a Sanity webhook.
5. Fill `.mcp.json` from the example.
