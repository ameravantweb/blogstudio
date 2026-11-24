# Move articles and images

The source download contains code and schema. Existing articles and images remain on the private Sites app. This optional process copies them to your own Cloudflare account. It does not change the existing site. Pause article edits during your final export for a consistent cutoff time.

## Export from the existing signed-in site

1. Sign in to your current Blog Studio and open the client article library. Wait for cloud saving to finish.
2. Open the browser developer console. Review `scripts/export-from-sites.js`, then run its contents there. It makes same-origin, read-only requests for records and referenced images; it does not send data to another service.
3. Save `workspace-export-YYYY-MM-DD.json` privately, outside GitHub. Check the record and image counts printed in the console. If export stops, resolve the reported image or login issue before moving the workspace.

For individual articles, you can instead use the app's JSON backup export and image download. JSON imports on the new site create copies owned by the importer; image files must be transferred separately. The complete process below preserves ownership and image paths.

## Map authors to their Cloudflare email addresses

From the standalone source folder, list the original owner IDs:

```sh
pnpm migration:prepare /path/to/workspace-export-2026-11-24.json
```

Create a local ignored `owners.json` mapping every printed owner ID directly to that author's Cloudflare Access email:

```json
{
  "ORIGINAL-OWNER-ID-ONE": "owner@your-company.com",
  "ORIGINAL-OWNER-ID-TWO": "colleague@your-company.com"
}
```

Sites and Cloudflare have different login identities. The new app uses the verified lowercase email as `owner_id`, so this mapping preserves each author's edit permissions. Everyone allowed through Access can still view/export shared articles.

## Prepare and check locally

```sh
pnpm migration:prepare /path/to/workspace-export-2026-11-24.json owners.json
pnpm db:local
pnpm migration:restore migration-output blog-studio-images --local
pnpm dev
```

Preparation validates records, checks referenced image files, and creates SQL, images, and a manifest in the ignored `migration-output/` folder. Set `LOCAL_DEV_EMAIL` to a mapped author's email to check their local edit access.

This is an initial copy tool. Use a new target database. `INSERT OR IGNORE` preserves existing target records with the same IDs, so reruns do not synchronize later article edits. Image uploads retain their original IDs and object paths.

## Restore remotely

Finish the README's storage and private Access setup first. Confirm `wrangler.jsonc` targets the intended new resources, then run:

```sh
pnpm db:remote
pnpm migration:restore migration-output blog-studio-images --remote
```

The command uploads private R2 images first, then imports D1 rows, using your local Wrangler login. Back up the target database before later imports if you have started using it.

Sign in through the private Cloudflare hostname as both authors. Check client groups, article text, completed status, images, and author permissions. Keep the original site available until you verify the copy.

Do not upload workspace exports, `owners.json`, `migration-output`, articles, or generated images to GitHub. Standard local backup paths are covered by `.gitignore`.
