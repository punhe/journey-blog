# Journal Blog

A dark, illustration-led personal journal. Astro builds the site as static
files, Sanity holds the content, and a Vercel Function counts views.

Design spec: [`docs/superpowers/specs/2026-09-21-journal-blog-design.md`](docs/superpowers/specs/2026-09-21-journal-blog-design.md).

| | |
|---|---|
| Site | Astro 7, static output, TypeScript |
| Content | Sanity, Studio embedded at `/studio` |
| Hosting | Vercel (one project: pages, Studio and functions) |
| View counts | Vercel Function + Upstash Redis |
| AI posting | `@sanity/mcp-server` in Claude Code or Claude Desktop |

## First run

1. **Create the Sanity project.** `npx sanity@latest init` (or sanity.io/manage).
   Note the project ID and the dataset name. Keep the dataset public, so the
   build needs no token.
2. **Fill in `.env`.** Copy `.env.example` if it is missing:

   ```
   PUBLIC_SANITY_PROJECT_ID=your_project_id
   PUBLIC_SANITY_DATASET=production
   SANITY_API_TOKEN=            # Editor token, only for seeding and MCP
   ```

   Create the token at sanity.io/manage → API → Tokens, role **Editor**.
3. **Allow the site to reach the Studio.** In sanity.io/manage → API → CORS
   origins, add `http://localhost:4321` and your Vercel URL, with credentials.
4. **Install and seed.**

   ```bash
   npm install
   npm run seed     # 1 site settings doc, 6 tags, 6 posts with generated covers
   npm run dev      # http://localhost:4321, Studio at /studio
   ```

   `npm run seed` does nothing if posts already exist. Pass `-- --force` to
   overwrite the seeded documents.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server, Studio at `/studio`. No view counts. |
| `npx vercel dev` | The same plus the `/api` functions. Needs the Redis variables. |
| `npm run build` | `astro check`, then a static build into `dist/`. |
| `npm run preview` | Serves the last build. |
| `npm test` | Vitest: the views function and the query helpers. |
| `npm run seed` | Placeholder content. See above. |
| `npm run deploy` | Build on Vercel from the local files and publish to production. |

## Publishing a post

Publish in the Studio. Nothing else. A Sanity webhook calls a Vercel deploy
hook, Vercel builds this repository, and the new pages are live in about a
minute.

`npm run deploy` still exists as a fallback: it uploads the local files and
builds them on Vercel, which is useful when the automatic chain is broken or
you want to see a change without committing it.

### How the chain is wired

1. **Sanity webhook** posts to a Vercel deploy hook on every transaction in
   the `production` dataset.
2. **Vercel deploy hook** starts a production build of the `main` branch.
   Pushes to `main` deploy as well, through the Vercel GitHub integration.
3. **Build settings** come from `vercel.json`. The `PUBLIC_SANITY_*` variables
   are set in the Vercel project, because the build has no `.env`.
4. **The build reads Sanity with `useCdn: false`.** The hook fires about a
   second after a publish. The API CDN still served the old dataset then, and
   builds shipped without the new post.

Nothing in that chain needs `SANITY_API_TOKEN`: the dataset is public to read.

## Deploying to Vercel

1. Import this repository as a Vercel project. `vercel.json` sets the build
   command (`npm run build`), the output directory (`dist`) and the rewrite
   that lets the Studio own `/studio/*`. Files in `api/` become functions.
2. Add `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` and
   `PUBLIC_SITE_URL` to the project's environment variables. The build does
   not need `SANITY_API_TOKEN`.
3. Add Upstash Redis from Vercel → Storage (Marketplace) and connect it to the
   project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without them
   the site works and the view counter stays hidden.
4. Add the Vercel project URL to the Sanity CORS origins, with credentials.

### Rebuild when a post is published

The site is static, so publishing in the Studio has to trigger a build.

1. Vercel → Project → Settings → Git → Deploy Hooks → create a hook for the
   `main` branch. Copy the URL.
2. sanity.io/manage → API → Webhooks → **Create webhook**:
   - URL: the deploy hook URL
   - Dataset: `production`
   - Trigger on: Create, Update, Delete
   - Filter: `_type == "post" || _type == "tag" || _type == "siteSettings"`
   - HTTP method: POST

## Writing posts with an AI agent

The Sanity MCP server lets Claude read and write documents in the dataset.
Nothing is installed in this repository; it runs through `npx`.

**Claude Code** — copy `.mcp.json.example` to `.mcp.json` and fill in the
values. `.mcp.json` is git-ignored because it holds the token.

**Claude Desktop** — add the same block to `claude_desktop_config.json`:

```json
{
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
}
```

Recommended flow: the agent creates the post as a **draft**, you read it in
the Studio, fix what needs fixing, and publish. Publishing fires the webhook
and the site rebuilds.

## View counter

`api/views.ts`, reachable at `/api/views`:

- `GET /api/views?slug=a` → `{ "views": { "a": 12 } }`, `0` when unseen
- `GET /api/views?slugs=a,b,c` → one map, 100 slugs per request
- `POST /api/views?slug=a` → increments and returns the new number

Home cards make one batched `GET` after load. An article makes one `POST`.
Repeat visits by the same reader count; there is no dedupe.

- Counts live in Upstash Redis under `post-views:<slug>`. The increment is
  Redis `INCR`, so overlapping requests do not lose a count.
- If Redis is not configured or cannot be reached, the function answers `200`
  with `"views": null` and the page hides the counter rather than showing `0`.

## Layout

```
astro.config.mjs        Astro + Sanity integration, Studio mounted at /studio
sanity.config.ts        Studio: schemas, structure, Vision
sanity/schemas/         post, tag, siteSettings
src/pages/              index, posts/[slug], tags/[slug]
src/components/         header, hero, cards, tag chips, Portable Text renderer
src/lib/sanity.ts       client, GROQ queries, image URLs, date format
api/views.ts            view counter (Vercel Function)
scripts/seed.ts         placeholder content, with a small PNG generator
tests/                  Vitest
```

## Not in v1

Search, RSS, comments, newsletter, a light theme, and pagination. The home
grid renders every post; revisit it past roughly 60 posts.
