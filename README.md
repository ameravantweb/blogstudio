# SEO + AEO Blog Studio

A private team workspace for client briefs, AI articles, featured images, editing, and HTML, plain text, Markdown, and JSON exports. Articles are grouped by client and saved in D1; images are stored in a private R2 bucket. Authorized colleagues can view/export shared work. Each author controls edits and deletion of their originals.

This standalone Cloudflare version is based on Sites version 9. The existing hosted site is unaffected by this export.

## 1. Upload to GitHub

Create a **private** GitHub repository. Upload the contents of this `source` folder, including `.gitignore`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`. Its root should contain `package.json`, `worker.ts`, and `wrangler.jsonc`.

Alternatively, from this folder after creating an empty private repository:

```sh
git init
git add .
git commit -m "Import Blog Studio"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-PRIVATE-REPO.git
git push -u origin main
```

Keep API keys, `.dev.vars`, workspace exports, and article backups out of GitHub. Standard secret and backup paths are covered by `.gitignore`.

## 2. Check locally

Use Node.js 24 and pnpm 11.25.0:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:local
pnpm dev
```

Open the localhost URL printed by the server. Local development uses the email in `.dev.vars`; that development identity is compiled out of production. The server binds to `127.0.0.1`. Local storage is separate from live storage. Optionally add your own API key to `.dev.vars` to test generation.

```sh
pnpm typecheck
pnpm test
pnpm build
```

## 3. Create Cloudflare storage

Sign in to your own Cloudflare account:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create blog-studio-articles
pnpm exec wrangler r2 bucket create blog-studio-images
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the returned D1 UUID. Update resource names there if you chose different ones; retain the binding names **`DB`** and **`BUCKET`**. Keep R2 public access disabled.

```sh
pnpm db:remote
```

## 4. Set up private access

Use a hostname in a domain managed by your Cloudflare account, such as `blog.your-domain.com`.

1. Enable Cloudflare Zero Trust and create an **Access self-hosted application** covering the entire hostname and all paths.
2. Add an **Allow** policy containing only the intended team members' email addresses. Configure an identity provider or email one-time PIN. Avoid Bypass and Everyone policies.
3. Copy the Access team domain and this application's Audience (AUD) tag into `wrangler.jsonc` under `vars`:

```json
{
  "CF_ACCESS_TEAM_DOMAIN": "https://YOUR-TEAM.cloudflareaccess.com",
  "CF_ACCESS_AUD": "YOUR-APPLICATION-AUD-TAG",
  "ALLOWED_EMAILS": "owner@your-company.com,colleague@your-company.com"
}
```

4. Add the custom domain route following the commented example at the end of `wrangler.jsonc`:

```json
"routes": [{"pattern":"blog.your-domain.com","custom_domain":true}]
```

Keep `workers_dev: false` and `preview_urls: false`. The Worker verifies the Access JWT signature, issuer, audience, expiry, and exact email allowlist before returning the app. Missing settings and unauthorized requests return 403. Visitor-supplied identity headers are not accepted as authentication.

To add colleagues later, update both the Access policy and `ALLOWED_EMAILS`. ChatGPT team membership does not configure Cloudflare Access.

## 5. Set the API secret and deploy

Use an OpenAI API key from your own API project:

```sh
pnpm exec wrangler secret put OPENAI_API_KEY
```

Enter the key at Wrangler's prompt. Do not commit it. The original Sites API secret is deliberately absent from this package. `OPENAI_MODEL` and `OPENAI_IMAGE_MODEL` in `wrangler.jsonc` preserve the original defaults; choose models available to your API project as needed.

```sh
pnpm deploy
```

Visit your hostname and sign in. Confirm that a private/signed-out browser requires sign-in. Save a brief, refresh to check persistence, and sign in as your colleague to verify the shared library. Real generation uses your API project.

## 6. Optional GitHub-connected builds

In Cloudflare **Workers & Pages**, connect your private GitHub repository to a Worker build using the same Worker name as `wrangler.jsonc`:

| Setting | Value |
| --- | --- |
| Project root | Repository root: the contents of `source/` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy --config dist/server/wrangler.json` |
| Node version | `24` |

Configure storage, Access, and the Worker secret first. Keep previews disabled unless equivalently protected. Use Workers for this server application; static upload and GitHub Pages cannot run its APIs.

## Existing articles and implementation

See [MIGRATION.md](MIGRATION.md) for optional article/image transfer. The source download does not contain production data or transfer ChatGPT logins.

React 19, Vinext, Vite, TypeScript, Tailwind CSS; Cloudflare Workers/D1/R2; Access JWT verification via `jose`; server-side OpenAI Responses and Images APIs. Revision checks protect against stale edits. The shared workspace holds up to 200 briefs/articles. Article length includes title, answer, body, and FAQs.

Official references: [Vinext](https://github.com/cloudflare/vinext), [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/), [R2 commands](https://developers.cloudflare.com/workers/wrangler/commands/r2/).
