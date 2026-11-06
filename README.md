# FragOut

**Find your element.** A mobile-first fragrance wardrobe, personal recommendation engine, and transparent layering lab.

This is a working **local first edition** built from the supplied FragOut product specification. It runs on your computer, with real private local accounts and SQLite persistence. It is not a production-hosted service and has no paid API dependency.

## Open the app

The running local preview is [http://localhost:3000](http://localhost:3000).

To start it later on Windows, double-click **Start FragOut.cmd** in this folder. Node.js **24 or newer** is required. The launcher installs missing dependencies and creates the production build if needed.

For terminal use, open this folder and run:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run start
```

Development with live reload:

```powershell
npm.cmd run dev
```

The server listens on this computer’s loopback interface. It does not expose the app to your local network. Close the server terminal or press Ctrl+C to stop it. Avoid running two copies on port 3000.

## What works

- Responsive dashboard with an owned-only daily pick and understandable reasons.
- Private account registration/sign-in/sign-out; salted scrypt password hashes; opaque sessions with HttpOnly SameSite cookies and seven-day expiration. No shared demo account.
- Exact fragrance identity by house, name/edition and concentration. Separate EDT/EDP/flankers; multiple bottles supported.
- Add, edit, remove, favorite, rate and search bottles; Owned, Wishlist and Not owned filters; fill level, size, private notes and personal scent profiles.
- Optional photo **reference** from camera/gallery, validated to JPG/PNG/WebP under 5 MB, previewed locally and discarded when the dialog closes. Users confirm the identity manually.
- Manual wearing conditions, humidity, indoor/outdoor temperature, hemisphere, event time, IANA time zone and fragrance-free/low-scent venue policy.
- Deterministic occasion recommendations, preferences, disliked-note exclusions and cautious gym/office projection limits. Unknown profiles stay out of ranking. Empty or unsuitable collections return honest empty states.
- Gym, Date, Work, Going out, Errands and custom shortcuts; custom label/icon, setting and strength; accessible reorder/hide/delete/reset controls.
- Layering always asks for an occasion. Evidence-backed is the default; missing evidence returns a clear gap. Single-report mode and experimental mode require deliberate selection. All generated local pairs are explicitly **experimental / untested** with no fabricated sources.
- Wear journal, saved pairings and feedback. Solo taste feedback affects personal ratings; pair failure does not downgrade either bottle and excludes that private pair from subsequent suggestions.
- Server-owned recommendation snapshots preserve the actual shortcut/event context in a wear log.
- Full account export, including journal entries beyond the 200 displayed in the UI; account deletion cascades across active records and revokes sessions.
- Educational pages, explicit integration status, original bottle illustrations and install-oriented web app metadata.

## Try a complete flow

1. Open the app. A private demo session contains six owned fictional scents and two wishlist examples.
2. Tap **Gym**. Only light scents appear; **Why?** explains the actual ranking rules.
3. Tap **Wear this**, then open **Wear journal** to see the occasion and context recorded.
4. Open **Layering lab**, choose **Date night**, and find a pair in **Evidence-backed only** mode. You will see an honest evidence gap.
5. Deliberately choose **Explore experimental pairings** and find an untested pair. Save it or record that it did not work.
6. Use **Customize** on the dashboard to create and move a shortcut, save it, then use it.
7. Choose **Start my wardrobe** to create a real local account. It begins empty. Add the exact name from your own bottle, then optionally enter your personal scent profile.
8. In settings, export your data or delete the account.

## Data and privacy

The app saves its SQLite database in `data/fragout.sqlite`, with SQLite WAL/SHM files while running. These files are ignored by Git and excluded from the source ZIP. They are **not encrypted at rest**; protect your computer and backups appropriately. Only the application’s owner-scoped API is an account boundary; people with filesystem access can inspect the database.

Reference photos are never uploaded or retained. Weather is manual. There are no model calls, research crawlers, analytics trackers or advertising integrations. Fonts and illustrations are bundled locally.

Demo sessions expire after seven days; stale demo accounts are removed when the server starts. Recommendation snapshots are retained for up to one day, then removed on startup. Real account data remains until deleted. Account deletion removes active database records; it does not erase copies in backups or guarantee forensic erasure of SQLite free pages. Exports contain no passwords or session credentials. There is no email verification or password-recovery service in this local edition.

## Honest limits and remaining production work

| Area | Current behavior | Remaining work from the broader specification |
| --- | --- | --- |
| Catalog | Manual-only real wardrobes; original fictional demo catalog | License approval, exact-variant research, at least 50 audited products and field-level source provenance |
| Identification | Ephemeral photo reference with mandatory manual confirmation | Real vision/OCR provider, private upload handling, top-three candidate matching, measured 100-photo evaluation and quotas |
| Weather | Explicit manual event snapshot | Licensed live provider, forecasts/freshness and optional permission-based location |
| Pair evidence | Empty reviewed pair registry; exact-tier eligibility engine is tested | Approved ingestion/review workflow, source/rights matrix, real brand/community/dupe records |
| Accounts | Real local identity and SQLite ownership isolation | Managed identity, email recovery, PostgreSQL migration and a deployment security review |
| Personalization | Favorites/ratings and recent private pair failures | Held-out quality calibration, longer-term wear history and recency/duration-aware scoring |
| PWA | Responsive UI, manifest and icon | Service worker/offline install evaluation and native phone acceptance checks |
| Hosting | Runs locally | Explicit hosting decision, durable database, HTTPS secure cookies, operational monitoring, accessibility/contrast audit and release approval |

No photo accuracy, catalog licensing, measured fragrance performance or recommendation-quality target is claimed. The app does not pretend missing integrations are working. Unknown scent profiles remain unknown. Changing identity clears the former variant’s scent traits; reopen it afterward to supply observations for the corrected variant.

## Architecture

- Next.js App Router / React / strict TypeScript.
- Server API at `src/app/api/[...path]/route.ts`; Zod validates all mutations and rejects unexpected fields.
- SQLite schema/migrations and owner-scoped repositories in `src/lib/store.ts`; no credential-bearing client API keys.
- Pure recommendation/evidence rules in `src/lib/engine.ts`; weights are an uncalibrated, versioned baseline.
- Typed domain in `src/lib/types.ts`, original sample fixtures in `src/lib/seed.ts`.
- Original SVG bottle artwork in `src/components/Primitives.tsx`; no third-party bottle photographs or catalog scraping.

Optional database location: set `FRAGOUT_DB` to an absolute persistent database path. Set `FRAGOUT_SECURE_COOKIES=true` only when serving through HTTPS. See `.env.example`; do not commit credentials or database files.

The choice of SQLite instead of PostgreSQL keeps this local build self-contained. It requires a persistent single-host Node process and is not designed for an ephemeral/serverless filesystem.

## Verify

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
# With the app already running:
node tests/http.mjs
```

Unit/integration tests use genuine in-memory SQLite and deterministic fixtures. The HTTP suite creates and deletes its own disposable test accounts. It checks real production API behavior, owner isolation, ownership constraints, export/deletion, venue policies and evidence gaps. Browser checks and current results are recorded in `docs/VERIFICATION.md`.

See `docs/IMPLEMENTATION.md` for decisions and `docs/VERIFICATION.md` for the tested boundaries. The original supplied specification files are preserved in `docs/original-spec/` as reference material.

Framework references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Node.js SQLite](https://nodejs.org/api/sqlite.html). These are implementation references, not fragrance evidence.
