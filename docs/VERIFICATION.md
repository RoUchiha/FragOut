# FragOut verification — 2026-11-06

Scope: the local first edition documented in `../README.md`, based on the supplied FragOut specifications. No remote production deployment was created.

## Executed results

| Check | Observed result |
| --- | --- |
| `npm.cmd run typecheck` | Passed, strict TypeScript, no diagnostics |
| `npm.cmd test` | 25 passed, 0 failed |
| `npm.cmd run build` | Passed; Next.js 16.4.5 production output for `/`, `/_not-found`, and dynamic `/api/[...path]` |
| `node tests/http.mjs` against production server | 20/20 grouped checks passed; disposable accounts removed afterward |
| Browser console | No captured warning/error entries in the final checked session |
| Desktop browser | Dashboard, visible permanent Recommend/Combo actions, collection, layering and profile rendered |
| Phone viewport | 390 × 844 checked; responsive navigation, cards, forms and modal flows usable; no horizontal document overflow observed |

The initial unit run failed before the implementation existed, then passed after the domain/storage implementation. Four regression cases exposed by independent code review were also observed failing before their fixes, then passing afterward.

## Domain and storage coverage

- Owned-only solo/pairs, variant deduplication, empty collections, unknown-profile abstention, no-fragrance venue, disliked notes, excluded bottles, gym strength, indoor temperature and hemisphere season policy.
- A 35-context scenario loop spans seven occasions and five temperatures, checking hard constraints and versioned reason IDs.
- Evidence rights restrictions, duplicate source-author independence, single-report tier, dupe downgrading, evidence-only gaps and explicitly experimental untested results.
- Actual in-memory SQLite accounts, password verification, session revocation, cross-user CRUD rejection, separate demo users and empty new real accounts.
- Exact concentration identity, duplicate bottles, identity-change profile invalidation, account deletion cascades, full history export past the 200-row UI window, server-owned recommendation context and pair feedback separation.
- Input boundaries for weather/timezone, shortcut ID/count limits and rejected owner/variant/provenance mass assignment.

## Live API checks

Health; authentication; empty new accounts; persisted owner-scoped CRUD; denied foreign writes/deletes; rejected unexpected owner fields; denied cross-origin mutations; gym recommendations; unknown profile exclusion; exact evidence gap; explicit experimental labels; denied foreign feedback; persistent wear logs; shortcut context snapshots; every default/custom-template shortcut; pair failure leaves solo ratings/favorites intact; rejected pair stays out of later experiments; fragrance-free policy in both modes; credential-free owner export; account deletion and revoked access.

## Observed browser paths

1. Open demo → original fictional scents and honest demo label appear.
2. Add exact named EDT bottle → enter own scent profile → save → search collection → edit to Wishlist → verify it leaves Owned → remove disposable test bottle.
3. Gym → light scents only → Wear this → journal shows Gym and indoor manual context.
4. Layering → choose Date → evidence-only → honest “No documented pairing” result.
5. Explicit experimental mode → untested pairs → Home → return to Lab → previous results cleared and controls reset consistently. The earlier mismatch was reproduced before the fix.
6. Customize → add “QA Calm Commute” → choose Work/indoor/light → move upward → save → use shortcut → Work results use indoor rules → reset defaults.
7. Create a disposable real local account → wardrobe starts empty → Layering has no previous account’s results → sign out → new demo → sign in again successfully → sign out. Disposable account removed after the test.
8. Phone view hides the off-canvas sidebar from the accessibility tree until opened; mobile navigation stays available. Dialogs include Escape handling, focus trapping and focus restoration. Full assistive-technology and WCAG contrast audits remain outstanding.

Screenshots are delivered beside the source folder as `FragOut-desktop.jpg` and `FragOut-mobile.jpg`. Desktop viewport overrides were reset before handoff.

## Independent review and corrections

An independent read-only review found six material problems. All were addressed:

- Clear recommendation arrays, context, request IDs and dialogs on account transitions.
- Persist server-owned recommendation context snapshots for accurate feedback.
- Export full owner-scoped history rather than the UI’s latest 200.
- Clear a previous variant’s scent traits when exact identity changes.
- Keep pair feedback separate from individual ratings; privately exclude rejected pairs.
- Clear pair results on navigation so reset controls cannot display stale experiments.

The underlying domain/storage corrections have regression tests. UI lifecycle corrections were checked through the browser. A second independent re-review was not performed.

## Build environment incident

One incremental build failed with Windows `EPERM` while recreating a generated `_not-found` output directory with a preview process active. After stopping the preview and verifying the generated directory was writable, a fresh production build completed successfully. The final production server was started only after that successful build and passed all 20 HTTP checks. Stop an existing production preview before rebuilding the same `.next` directory.

## Deliberate boundaries

This verification does not establish vision recall, real catalog accuracy, rights approval for third-party content, real-world fragrance fit, live-weather licensing, managed identity readiness, hosted security or native-device PWA install quality. No paid API calls, external research ingestion or publishing were performed. Manual-only real data and original fictional demo fixtures are the current supported content pathway.
