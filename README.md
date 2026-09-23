# Journal Blog

A dark, illustration-led personal journal. Astro builds the site as static
files, Sanity holds the content, and a Netlify Function counts views.

Design spec: [`docs/superpowers/specs/2026-09-21-journal-blog-design.md`](docs/superpowers/specs/2026-09-21-journal-blog-design.md).

| | |
|---|---|
| Site | Astro 7, static output, TypeScript |
| Content | Sanity, Studio embedded at `/studio` |
| Hosting | Netlify (one site: pages, Studio and functions) |
| View counts | Netlify Function + Netlify Blobs |
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
   origins, add `http://localhost:4321` and your Netlify URL, with credentials.
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
| `npx netlify dev` | The same plus the functions and the local Blobs store. |
| `npm run build` | `astro check`, then a static build into `dist/`. |
| `npm run preview` | Serves the last build. |
| `npm test` | Vitest: the views function and the query helpers. |
| `npm run seed` | Placeholder content. See above. |
| `npm run deploy` | Build, then push the result to Netlify. |

## Publishing a post

Publish in the Studio. Nothing else. A Sanity webhook calls a Netlify build
hook, Netlify builds this repository, and the new pages are live in about a
minute.

`npm run deploy` still exists as a fallback: it builds locally and pushes the
result straight to Netlify, which is useful when the automatic chain is broken
or you want to see a change without committing it.

### How the chain is wired

1. **Sanity webhook** `Netlify rebuild` posts to a Netlify build hook on every
   transaction in the `production` dataset. It carries no filter: the dataset
   holds only posts, tags and the settings singleton, so every change is a
   change worth rebuilding for.
2. **Netlify build hook** starts a build of the `main` branch.
3. **Netlify reads this repository** through a read-only deploy key rather than
   the GitHub App. The repository also carries a webhook that tells Netlify
   about pushes, so a commit deploys as well.
4. **Build settings** come from `netlify.toml`. The two `PUBLIC_SANITY_*`
   variables are set in the Netlify site, because the build runs on their
   machines and has no `.env`.

Nothing in that chain needs `SANITY_API_TOKEN`: the dataset is public to read.

## Deploying to Netlify

1. Create a site from this repository. `netlify.toml` already sets the build
   command (`npm run build`), the publish directory (`dist`) and the functions
   directory (`netlify/functions`).
2. Add `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET` to the site's
   environment variables. The build does not need `SANITY_API_TOKEN`.
3. Netlify Blobs needs no setup. The store `post-views` is created on the
   first write.

### Rebuild when a post is published

The site is static, so publishing in the Studio has to trigger a build.

1. Netlify → Site configuration → Build & deploy → Build hooks → **Add build
   hook**. Copy the URL.
2. sanity.io/manage → API → Webhooks → **Create webhook**:
   - URL: the build hook URL
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

`netlify/functions/views.ts`, reachable at `/api/views`:

- `GET /api/views?slug=a` → `{ "views": { "a": 12 } }`, `0` when unseen
- `GET /api/views?slugs=a,b,c` → one map, 100 slugs per request
- `POST /api/views?slug=a` → increments and returns the new number

Home cards make one batched `GET` after load. An article makes one `POST`.
Repeat visits by the same reader count; there is no dedupe.

Two caveats, both deliberate:

- The store is opened in strong consistency mode. Blobs reads are eventually
  consistent by default, which made every increment read a stale number and
  the count stuck at 1.
- The increment reads and then writes. Netlify Blobs has no compare-and-set,
  so two overlapping requests can lose one increment.
- If the store cannot be reached, the function answers `200` with
  `"views": null` and the page hides the counter rather than showing `0`.

## Layout

```
astro.config.mjs        Astro + Sanity integration, Studio mounted at /studio
sanity.config.ts        Studio: schemas, structure, Vision
sanity/schemas/         post, tag, siteSettings
src/pages/              index, posts/[slug], tags/[slug]
src/components/         header, hero, cards, tag chips, Portable Text renderer
src/lib/sanity.ts       client, GROQ queries, image URLs, date format
netlify/functions/      views.ts
scripts/seed.ts         placeholder content, with a small PNG generator
tests/                  Vitest
```

## Not in v1

Search, RSS, comments, newsletter, a light theme, and pagination. The home
grid renders every post; revisit it past roughly 60 posts.
