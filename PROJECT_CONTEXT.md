# FragOut: maintained project context and chat handoff

**Last context review:** 2026-11-24 UTC (November 23 in America/Chicago).

**Last substantive application release:** PR [#16](https://github.com/RoUchiha/FragOut/pull/16), main commit **905c925b4ae07c18217938053a7c8a8d89f6c1e3**, reviewed feature head **80976fde5c924100aac7bab33221bae76f887d3b** with the same tree. Later documentation changes record the verified release outcome. Use Git and the live health endpoint for the exact current documentation/deployment SHA; do not try to put this file's own commit hash inside itself.

**Purpose:** A future chat should be able to understand the user's intent, inspect the right code, operate safely and resume unfinished work without this conversation. This is a curated handoff, not a claim that every requested feature or launch requirement is complete.

## Contents

1. [Mandatory maintenance protocol](#1-mandatory-maintenance-protocol)
2. [Start a new chat here](#2-start-a-new-chat-here)
3. [Current state and immediate next work](#3-current-state-and-immediate-next-work)
4. [User intent and settled product decisions](#4-user-intent-and-settled-product-decisions)
5. [Architecture and source map](#5-architecture-and-source-map)
6. [Environments and cloud resources](#6-environments-and-cloud-resources)
7. [AI routing, activation and paid controls](#7-ai-routing-activation-and-paid-controls)
8. [Security and data lifecycle contracts](#8-security-and-data-lifecycle-contracts)
9. [FragDex, sources, photos and layering](#9-fragdex-sources-photos-and-layering)
10. [Production-to-test copy and recovery](#10-production-to-test-copy-and-recovery)
11. [Local development and private iPhone testing](#11-local-development-and-private-iphone-testing)
12. [Native release and advertising](#12-native-release-and-advertising)
13. [Verification and evidence](#13-verification-and-evidence)
14. [GitHub, deployment and rollback](#14-github-deployment-and-rollback)
15. [Known traps and resolved failures](#15-known-traps-and-resolved-failures)
16. [Priorities and open limitations](#16-priorities-and-open-limitations)
17. [Documentation and local artifact index](#17-documentation-and-local-artifact-index)
18. [Decision history and handoff journal](#18-decision-history-and-handoff-journal)

## 1. Mandatory maintenance protocol

The owner explicitly asked for a full, highly detailed context file and said it should stay updated whenever changes are made. **Every future contributor or coding agent must maintain this file as part of the work.** Root [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) and the README point here.

This requirement applies to application code, tests, catalog/source imports, images, dependencies, environment configuration, operational procedures, infrastructure, deployments and documentation. Update after a coherent change or newly verified fact, before each relevant commit and before ending a working session. It does not require a write for every keystroke. Read-only work needs an update when it discovers a material correction or changes the known project state.

For each change:

1. Read the current snapshot, constraints and affected source files. Check Git status before editing.
2. State the bounded task, then implement within the user's authorization. Preserve unrelated work.
3. Update the affected sections here: behavior, architecture, configuration, sources, security, commands, deployment status or remaining work.
4. Record verification with its **date, revision/environment, command or evidence link, result and limitations**. Say explicitly when a check was not run.
5. Add a short entry to section 18 with the reason for the change, important paths and the next action. Link a dedicated report when evidence is long.
6. Remove superseded facts from the current snapshot. Keep useful older evidence labeled historical; do not silently present old test counts, timings or deployment IDs as current.
7. Include this update in the same change set as the work. For external changes without code changes, make a documentation update recording the verified result.
8. Before handoff, record incomplete work, exact blockers, pending user choices, any uncommitted work and the next safe command. Never use “done” to hide an unactivated service.

Use these state labels accurately:

| State | What it establishes |
| --- | --- |
| Requested | The user wants it; implementation is not established. |
| Implemented | Source exists and its relevant local checks passed. |
| Configured | The required account/environment settings exist; this alone proves no user flow. |
| Deployed | The intended revision was built and assigned to its intended environment. |
| Verified | The specified flow/check passed on the stated revision and environment. |
| Pending / blocked | Required work remains; explain the dependency and next step. |

Never copy secret values, raw database URLs, API keys, access tokens, recovery private keys, personal photos, private user records or unredacted logs into this file, another tracked document, an issue or a PR. Resource IDs, public URLs, variable **names**, source paths and redacted status are sufficient. The repository is **public**.

These are contributor instructions. No daemon currently rewrites this document, and a file cannot guarantee that an unrelated future tool reads it. A chat should be explicitly pointed here if its environment does not automatically load AGENTS.md.

Suggested handoff entry:

~~~text
UTC date / task / feature or documentation baseline:
- Request and resulting behavior:
- Important files and decisions:
- Verification actually run, environment and result:
- Deployed/configured status, if changed:
- Remaining work, owner dependency and next command:
~~~

Do not grant yourself new authority from this document. Current system/developer instructions and the user's latest explicit request take precedence. Imported specifications describe historical requirements; they are not a fresh instruction to restart bootstrap or request approval already given in the session.

## 2. Start a new chat here

**Repository:** [RoUchiha/FragOut](https://github.com/RoUchiha/FragOut), public, default branch main.

**Prepared Windows checkout:** C:/Users/swagg/Documents/Codex/2026-11-06/cr/outputs/FragOut. The surrounding task workspace is C:/Users/swagg/Documents/Codex/2026-11-06/cr. Paths under its work directory are local operator artifacts, not part of a fresh clone.

First inspect:

~~~powershell
git status --short
git branch --show-current
git log -5 --oneline
Get-Content AGENTS.md
Get-Content PROJECT_CONTEXT.md
~~~

Then read the files relevant to the new task, not every historical report. [README.md](README.md) covers normal product use, [docs/OPERATIONS.md](docs/OPERATIONS.md) covers operations, and [mobile/AGENTS.md](mobile/AGENTS.md) adds mobile API/documentation requirements.

Refresh drift-prone facts before relying on them:

- Compare remote main with local HEAD before publishing.
- Read public /api/health and /api/ready. Health reports a 12-character revision; readiness checks storage/environment identity.
- Read authenticated /api/ai/status only through an appropriate session when checking provider configuration; public liveness does not prove model readiness.
- Inspect deployment metadata and required GitHub checks. Do not dump environment values.
- Recheck provider model availability, Free/ZDR settings, billing limits and relevant versioned documentation before changing an integration.
- Ask for missing account access only after completing independent work. Never ask the user to paste a provider key into chat.

Do not rebuild over a running private test server. Identify and stop only this checkout's owned server process first; restart it after the build. Do not kill unrelated Node processes or Ollama.

## 3. Current state and immediate next work

| Area | State at the last substantive release |
| --- | --- |
| Public web app | Deployed at [fragout-wardrobe.vercel.app](https://fragout-wardrobe.vercel.app); primary mobile web interface at [/mobile](https://fragout-wardrobe.vercel.app/mobile). |
| API/storage | Production private Supabase schema and vault configured; public liveness/readiness returned 200 for the November 21 feature release 905c925b4ae0. No database migration or production-data writes were used for the comparison/release checks. |
| App-funded paid AI | Explicitly OFF. Production backend preference is auto; exact paid opt-in is false. No AI credit purchase or paid upgrade was performed. |
| Free hosted selfie model | Groq Qwen3.8 27B adapter deployed, but **not activated** at the last authenticated check. Dedicated Free key and Free/ZDR confirmations remain outstanding. Do not claim live hosted photo inference works yet. |
| Typed/dictated outfits | Verified offline clothing parser; no hosted inference required under Qwen. Recommendations remain grounded in owned bottles and recorded source evidence. |
| Private test | Separate local SQLite/key, HTTPS private Wi-Fi server at 192.168.68.82:3444; local loopback Qwen. Depends on this PC and certificate trust. |
| Backups | Dedicated SELECT-only reader, encrypted local/off-site snapshots and encrypted vault escrow activated. Daily workflow configured for 06:17 UTC; successful initial manual run verified. |
| Native clients | Web, Android and iOS JavaScript/Hermes exports passed for the November 21 comparison/fixes (PR 16). This is **not** evidence of a new signed APK/IPA or TestFlight/App Store delivery. |
| Mobile store release | User chose TestFlight for iPhone testing. Signing, current device build/upload, Apple processing and physical-device acceptance still need their own verified release evidence. |
| FragDex | 218 fully profiled, cross-checked editions with bundled bottle photos; broader searchable identity catalog; 241 reviewed dupe relationships; 249 Will It Layer source-pair references. Coverage is finite. |
| Ads | Native AdMob banner integration exists; empty/unloaded slots collapse and receive no interaction. Live publisher configuration and device verification are separate. |

**Immediate unfinished service task:** complete protected Groq Free/ZDR/key setup, then run an actual synthetic-photo smoke test through the published app. Keep paid off. Do not spend money as a shortcut.

**Immediate native task after activation:** verify the latest signed client includes the Groq-specific destination disclosure; older clients are deliberately rejected before a Groq upload. Establish a real TestFlight build and physical-iPhone acceptance instead of calling bundle exports “published.”

**Model comparison (November 21):** completed actual local qwen3-vl:2b-instruct versus the requested blind gpt-6.1-sol session reference on 15 image and four typed cases. The checked app pipeline passes the fixed small-corpus criteria after parser/OCR/validation fixes: 3/3 readable labels, 3/3 unsuitable-image abstentions, no unsupported grounded bottle identity, and 14/14 top-solo comparisons (seven photos in two wardrobes). Raw Qwen is materially weaker: image-only bottle recall 0/3 versus 3/3, OCR-assisted raw recall 1/3 versus 3/3, strict raw unsuitable-image abstention 1/3 versus 3/3. Local CPU median/p95 model calls were 30.30/33.21 seconds. Do not claim raw equivalence, general prompt-injection immunity or natural-selfie certification. The session reference requires no OpenAI API key and is not an API sampling/latency benchmark. Hosted Qwen3.8 27B remains untested and unconfigured (metadata rechecked November 21). See [the full report](docs/MODEL_COMPARISON.md) and [fixed plan](docs/superpowers/plans/2026-11-21-model-comparison.md). Source/release verification is tracked in section 13.

**Direct layering follow-up (November 21): similarity NOT confirmed.** Actual local 2B Qwen versus blind 6.1 Sol across 14 unique catalog-backed synthetic-collection scenarios produced only **3/24 shared valid comparison slots (12.5%)** in eight discretionary cases, any shared pair in **2/8**, and the same first pair in **0/8**. Qwen respected all pair constraints in 7/14 cases and correctly abstained in 0/3 empty controls; Sol scored 14/14 and 3/3. Qwen usually copied comma-separated supplied note lists instead of one note: strict one-note compliance 0/14, but comma-list grounding diagnostic 13/14 (do not misstate that all ingredients were invented). It also mixed unselected fragrances into explanations and followed a hostile wishlist/unknown request. Two Qwen repeats were identical but retained errors. The previous vision result used a shared deterministic ranker and cannot establish raw model layering equivalence. See [the direct report](docs/LAYERING_MODEL_COMPARISON.md) and [fixed plan](docs/superpowers/plans/2026-11-21-layering-comparison.md). Production layering behavior, providers, paid routing and native clients are unchanged; do not wire raw 2B layering proposals into recommendations. Hosted 27B remains a separate untested route.

The owner later requested this maintained handoff. Adding it does not authorize enabling paid AI, buying credits, accepting new terms, changing database hosting or making unrelated product changes.

## 4. User intent and settled product decisions

The app began from the supplied FragOut specification folder, copied into [docs/original-spec](docs/original-spec/README.md). The user subsequently approved following the specifications and delegated routine implementation decisions. Later requests refine or supersede earlier suggestions.

### Product and interface

- Mobile is primary so users can take bottle photos and outfit selfies. Maintain the web client and desktop companion as well.
- Keep the interface condensed, restrained and text-light. Avoid generic “AI app” prose, oversized suggestion heroes or unnecessary explanatory panels.
- Keep two primary tabs: **Home** with a home icon, collection and Add/scan controls; **Find a scent** with a lightbulb icon.
- Put compact suggestions beneath the search bar. Mood, vibe, occasion and pairing controls belong in compact search/filter flows.
- Support mood cues such as happy/tired/sad and desired scent vibes such as clean/mysterious/warm. Vibe has more weight than mood; venue/exclusion rules take priority.
- Use season/time-of-day palettes with the device's local time and the selected hemisphere.
- Let users like layering pairs and open all liked combos from Home. Likes are private and separate from wearing history and individual bottle ratings.
- Preserve collection shelves, sample/decant metadata, grid/list and sort preferences, profiling, catalog discovery, note filters, comparison and wear-calendar/CSV flows added after reviewing Parfumo.

### Photos, AI and privacy

- Bottle scans need review/confirmation of exact house, fragrance, edition and concentration. Product shape alone is not identity evidence.
- Outfit matching supports selfie, gallery image, typing and dictation. The user reviews clothing details before matching fragrances or layers.
- Free default first; users can explicitly connect their own OpenAI/Claude API keys. These are **API-key connections, not OAuth or chat-subscription sign-in**.
- Preserve an owner-controlled on/off switch for app-funded paid hosting. Never silently turn free failures into billed requests.
- Default selfies must not be archived. Bottle scan copies are disposable. Only explicit outfit-archive opt-in plus reviewed look confirmation may retain a selected outfit photo.
- Privacy/security is a central user requirement. Report concrete tests and limits; never promise that credentials are “unhackable” or impossible to expose.

### FragDex and source quality

- Popular designer, niche and affordable fragrances should have useful, sourced entries: notes, ratings/performance, edition-specific bottle image and dupe links.
- Every major rating row must exist on a five-star scale or show N/A. Supported estimates must be labeled and retain their evidence; never fabricate a number to fill a row.
- Ratings and bottom source links open the relevant fragrance/retailer page in an in-app browser sheet.
- A premium scent can show a few best-supported alternatives; recognized dupes should name the original. Similarity is not identity.
- The selected thumbnail is automatic. The ordinary user does not pick source images; an administrator can correct shared photos in Settings.
- Show one clean front or three-quarter bottle thumbnail and enlarge that same image on tap. There is no separate bottle-photo gallery feature.
- Earlier requests explored Google Images and rejected Wikimedia; the **latest implemented source preference is Parfumo, then official manufacturer, then trusted retailers**. Google links remain investigation aids. Do not regress to Wikimedia or arbitrary search-result hotlinks.
- Learn from public Parfumo/Will It Layer workflows and evidence without claiming access to their private code, proprietary ranking algorithms or a license to reproduce their whole databases/reviews.

## 5. Architecture and source map

### Platform

The root app is Next.js App Router + React + strict TypeScript, with one Node API used by desktop, Expo web and native apps. Root package version is 0.1.0; mobile is 0.2.0. **Node 24.x** is required; CI pins 24.16.0. Read lockfiles for exact resolved dependency versions rather than inferring from package ranges.

The mobile app uses **Expo SDK 58**, React Native 0.88.1, React 19.3.0 and Expo Router. Root and mobile have separate npm lockfiles/installations. The root React version and mobile React version are intentionally not forced to match.

| Concern | Important files |
| --- | --- |
| Root package/build | [package.json](package.json), package-lock.json, [vercel.json](vercel.json), [next.config.ts](next.config.ts) |
| Desktop UI | [src/components/App.tsx](src/components/App.tsx), Screens.tsx, Forms.tsx, CatalogTools.tsx, WearJournal.tsx, LayeringLibrary.tsx |
| Mobile navigation/UI | [mobile/src/app/index.tsx](mobile/src/app/index.tsx), app/_layout.tsx, Collection.tsx, Suggester.tsx, Settings.tsx, ui.tsx |
| Outfit and provider screens | [mobile/src/Outfit.tsx](mobile/src/Outfit.tsx), Connections.tsx, cloud-ai.ts, capture.ts, photo-lifetime.ts |
| Catalog screens/admin | mobile/src/CatalogBrowser.tsx, FragranceProfile.tsx, FragDexRatings.tsx, FragDexDupes.tsx, FragDexLink.tsx, FragDexAdmin.tsx |
| Journal/looks/export | mobile/src/Journal.tsx, SavedLooks.tsx, Results.tsx, export-data.ts |
| API entry and request boundary | [src/app/api/[...path]/route.ts](src/app/api/%5B...path%5D/route.ts), [src/proxy.ts](src/proxy.ts), src/lib/security.ts, observability.ts |
| Database/account domain | [src/lib/store.ts](src/lib/store.ts), [src/lib/database.ts](src/lib/database.ts), validation.ts, types.ts, environment.ts |
| Ranking and search | src/lib/engine.ts, intent.ts, scent-search.ts, outfit.ts, recommendation-evidence.ts |
| AI/private data | [src/lib/ai-api.ts](src/lib/ai-api.ts), providers.ts, qwen-runtime.ts, vault.ts, private-looks.ts |
| Bottle OCR | src/lib/bottle-label-ocr.ts, bottle-label.ts; packaged Tesseract worker/core/language assets |
| Catalog identity/research | src/lib/catalog.ts, catalog-editions.ts, catalog-discovery.ts, catalog-ratings.ts, fragella.ts, layering-catalog.ts |
| Automatic bottle image selection | src/lib/catalog-photo-selector.ts, parfumo-photo.ts, manufacturer-photo.ts, bottle-packshot.ts, catalog-http.ts, catalog-photo-store.ts |
| Private disk/environment | src/lib/private-directory.ts, private-path.ts, private-test-runtime.ts |
| Recovery | [src/lib/backups.ts](src/lib/backups.ts), scripts/ops.mjs, scripts/ops-setup.mjs, [ops/backup-public.pem](ops/backup-public.pem) |
| Paid/free operator setup | scripts/ai-operator.mjs, configure-free-ai.mjs, Configure-Free-AI.ps1, set-paid-ai.mjs |
| Policies | src/app/privacy/page.tsx, support/page.tsx, delete-account/page.tsx |

The API uses strict request schemas and session-derived owners. Domain code must work across SQLite and Postgres through the small async DataConnection interface. Do not replace owner-scoped queries/transactions with client-supplied owner IDs.

Local SQLite uses foreign keys, WAL, secure-delete and a dedicated private data directory. Hosted production requires managed Postgres and a stable vault key. Database migrations are under [supabase/migrations](supabase/migrations); schema_migrations and deployment_identity protect compatibility and environment identity.

The bundled catalog is source-controlled JSON plus cleaned public thumbnails. User wardrobes, private notes, connected keys, archives and admin overrides are database records, not committed fixtures. New accounts start empty; fictional demo data is isolated and expires.

## 6. Environments and cloud resources

Resource IDs below are nonsecret routing identifiers. Never substitute their credentials into this file.

| Resource | Identifier / purpose |
| --- | --- |
| Vercel team | rouchihas-projects; team_VvCDKAaJ7mUDq2rJjFQ0rSsm |
| Production project | fragout-wardrobe; prj_am2fYjn2SVu3Ox4vBdpFQTvWtjzA |
| Public origin | https://fragout-wardrobe.vercel.app |
| Reserved cloud test | fragout-test; prj_JFRIZRYAyY2uSYw6gxKmGldzKi3k; Vercel authentication protection, no app DB or production secrets connected at last verification |
| Backup operations project | fragout-backups; prj_zUxW5OcrTPtbLBuWDGcBDzfdP2Ct |
| Private backup Blob store | fragout-production-backups; store_Wr8qYeHHth44JCJa; iad1; private access |
| Production Supabase | project ref dniacgbevfltihvjyimz; private schema fragout |
| Runtime database role | fragout_app; application access, no database-owner/admin privileges |
| Backup reader role | fragout_backup_reader; LOGIN, SELECT-only, read-only defaults, no administrative/write privileges at last verification |
| Local test origin | https://192.168.68.82:3444; /mobile is the main interface |
| Local model | Loopback Ollama at 127.0.0.1:11434, qwen3-vl:2b-instruct; cloud disabled |
| Native identity | app.fragout.mobile for Android package and iOS bundle ID |
| Expo project | owner rosingh, slug fragout-mobile, project ID 0b9aabf4-fe4d-4a6a-a847-3a2a82cc9ffa |

The user explicitly chose to **keep the test database local** after the Supabase Free project limit was reached. Do not provision Neon, accept new terms or copy production credentials into Preview to make a build pass.

Production database/vault secrets are Sensitive, scoped only to Production. Their intended names are FRAGOUT_DATABASE_URL and FRAGOUT_VAULT_KEY. The exact public HTTPS origin is FRAGOUT_PUBLIC_ORIGIN. Privacy/support contact variable names are in .env.example; verify real contact configuration before store submission.

For Supabase use the session pooler on **5432**, dedicated role and verified TLS/hostname; transaction pooling on 6543 is rejected by this implementation. Public anon/authenticated API roles must not have USAGE/read access to the private schema. Security advisors were clean during the November 18 activation; recheck after schema/permission changes.

Environment identity is enforced by code and a database marker. Production refuses SQLite; staging requires an explicit separate database path. A database marked production is never an import destination for the test refresh. Preview deployments without their own valid managed storage must fail safely rather than borrow production storage.

## 7. AI routing, activation and paid controls

### Effective routing

See [src/lib/qwen-runtime.ts](src/lib/qwen-runtime.ts), [src/lib/providers.ts](src/lib/providers.ts) and [docs/OPERATIONS.md](docs/OPERATIONS.md#hosted-photo-analysis).

| Setting / mode | Behavior |
| --- | --- |
| Development or local staging | Local Ollama by default. The private test launcher strips hosted credentials/settings. |
| Production, backend auto | Groq Free unless the exact paid flag is true. Production defaults to auto even without a backend variable. |
| Production, backend gateway with paid OFF | Still resolves to Groq Free; an old gateway preference cannot bypass the paid-off switch. |
| Production, backend groq | Stays free even when the paid flag is present. |
| FRAGOUT_PAID_AI_ENABLED=true exactly | With the applicable hosted backend, selects app-funded Vercel AI Gateway. Missing, false and uppercase TRUE do not enable it. |
| Explicit user OpenAI/Claude selection | Uses only that user's connected encrypted API key. Separate from the operator's app-funded switch. |

Free model: **qwen/qwen3.8-27b**, fixed HTTPS destination https://api.groq.com/openai/v1/chat/completions.

Paid model: **alibaba/qwen3.8-27b**, fixed HTTPS destination https://ai-gateway.vercel.sh/v1/chat/completions. It uses the official @vercel/oidc 3.8.10 helper to obtain the **current invocation's** deployment token; do not cache a build-time token or replace the SDK with an environment-only implementation.

Paid routing requests zero data retention, disallows prompt training and restricts providers to the reviewed Wafer/Parasail endpoints. Keep these restrictions; never relax them to “fix” unavailable capacity.

### Free activation still required

The last authenticated production check (2026-11-19 03:47 UTC) reported Groq/free/paid-off and **configured false**. That is a configuration block, not a model-quality or speed result.

Activation requires all of:

- GROQ_API_KEY: dedicated server key, stored Sensitive and Production-only.
- FRAGOUT_GROQ_FREE_CONFIRMED=true: operator confirms a dedicated Free account without a payment method.
- FRAGOUT_GROQ_ZDR_CONFIRMED=true: operator enables and confirms account-level Zero Data Retention for inference.

The documented inference API does not independently attest Free billing status or organization ZDR. These are explicit operator confirmations. Reconfirm after account changes; remove readiness flags to suspend photo uploads if uncertain. Do not claim that adding store:false to Groq chat establishes ZDR: that Chat Completions parameter is unsupported; account Data Controls are required.

Protected setup, from the repo:

~~~powershell
pwsh -NoProfile -File scripts/Configure-Free-AI.ps1
~~~

Or double-click **Configure Free AI.cmd**. It prompts for FREE, ZDR and a hidden key. It checks model access with the models endpoint without a photo inference, keeps paid off, stores the key through stdin to the operator CLI and redeploys the current published source. No key is written to a file, command argument, client bundle or chat. Missing provider setup cannot be solved by inventing a credential.

The pinned Vercel CLI is 58.4.4. The helper reads undecrypted project metadata first and refuses matching variables shared with Preview, Development, custom environments or branches, or ambiguous duplicates. Its env add syntax uses positional production. Do not replace it with an unsupported newer --environment flag or a blind env update that preserves shared targets.

After owner activation, use a synthetic outfit fixture to verify the real published upload/receipt, clothing output, no-default-photo retention and cleanup, then measure actual model latency. A models-list access check alone does not prove inference.

### Paid on/off

From an operator-signed-in terminal in the repository:

~~~powershell
npm.cmd run ai:paid -- off
npm.cmd run ai:paid -- on
npm.cmd run ai:paid -- off --dry-run
~~~

These are operator commands, not a normal-user API endpoint. They update Production settings and redeploy. Off disarms the flag first; On arms it last. Postchecks verify production, release capabilities, the same source revision, paid state and storage readiness. Changes take effect after the deployment is ready and do not cancel in-flight requests.

The user requested a paid switch, **not a purchase**. No credits were bought. The previously configured $5/month project Gateway budget is a request-boundary safeguard, not a guaranteed hard spending ceiling. At the last account check the balance was zero. Reverify billing before any separately authorized paid activation; do not assume current funds or an account-wide auto-top-up state.

### Transport, consent and grounding contracts

- Hosted photos require a current destination/model/policy receipt. Free Groq uses policy qwen-groq-free-v1.
- Groq additionally requires disclosureVersion **'2'**, constructed explicitly by the updated client in mobile/src/cloud-ai.ts. It is deliberately absent from server status. Old clients that displayed fixed Gateway text cannot merely echo new status metadata and upload to Groq: they receive 409/update-required before transport.
- Session, selected provider and current model/destination/policy are rechecked immediately before outbound transport, after OCR and token resolution. Preserve the beforeTransport authorization callback.
- Images are sanitized first, and malformed photos get 400 even if hosted setup is unavailable. Consent/setup/quota failures do not persist image bytes.
- Groq requests use strict JSON schema, temperature 0, non-thinking mode and bounded completion tokens. Output is validated again by the app.
- Qwen only extracts directly visible clothing or readable bottle text. It must not invent fragrance facts, identity from bottle shape, demographics or compatibility.
- Typed/dictated Qwen descriptions use deterministic clothing rules. Search, mood/vibe ranking and evidence-backed layering are deterministic catalog/wardrobe operations, not an LLM's recollection.
- Free quota: 2 photo requests per installation/minute, 10 per user/fixed day, 50 per installation/fixed day. Paid installation allowance is 150/fixed day. All analysis also has the existing 8/user/minute protection. Provider token/rate limits may reject earlier.
- Windows are fixed, anchored by the first request, not sliding guarantees. Quota exhaustion/outage returns a safe failure with a typed-input alternative; **there is no automatic paid fallback**.

Provider references to recheck when changing behavior: [Groq model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [limits](https://console.groq.com/docs/rate-limits), [data controls](https://console.groq.com/docs/your-data), [structured output](https://console.groq.com/docs/structured-outputs), [Gateway ZDR](https://vercel.com/docs/ai-gateway/security-and-compliance/zdr).

## 8. Security and data lifecycle contracts

These boundaries are essential behavior, not optional refactoring opportunities.

| Data / boundary | Required behavior |
| --- | --- |
| Passwords | Salted scrypt hashes; no plaintext storage/export. Email verification and managed recovery are not implemented. |
| Sessions | Hashed server tokens; seven-day expiry; immediate revoke on logout/account deletion. |
| Browser companion | HttpOnly SameSite cookie; Secure and __Host- naming on HTTPS; exact-origin/CSRF checks. |
| Native session | Origin-bound SecureStore envelope; device-only accessibility; server/account changes invalidate pending operations. |
| Expo web session | Token in memory; API stays on the document origin, including private test; never reroute it silently to production. |
| Owner isolation | Session-derived owner on collections, notes, journal, connections, receipts, looks/photos, comparisons and exports. Foreign IDs return safe denial. |
| Connected provider keys | AES-256-GCM encrypted, owner-bound, never returned to clients or included in exports. No automatic borrowing of another user's key. |
| Default selfie | Process in memory; no backend photo row. App-owned picker/cache copy removed when submitted, including failures. |
| Bottle scan | Sanitized in-memory scan; app-owned copy removed after label reading, before accuracy confirmation/add. Cannot be archived. |
| Gallery original | User-owned photo-library original is untouched; delete only copies owned by FragOut. |
| Optional archive | Requires separate archive opt-in, current consent epoch and explicit reviewed recommendation/look confirmation. |
| Pending archive photo | Encrypted, at most 15 minutes while reviewing. Does not become a saved photo merely by upload. |
| Saved look photo | Encrypted and owner-only via authenticated endpoints, never public image URLs. Delete/opt-out/account removal deletes active copies. |
| Archive off/on race | Turning off atomically deletes looks/photos and revokes older in-flight retention consent, even after quickly turning back on. |
| Unsaved clothing | Outfit receipts/recommendation clothing copies expire after 15 minutes. Cleanup on access/startup/timer; hosted cleanup also exists in Postgres. |
| Exports | Owner-scoped; exclude passwords, tokens, API keys and photo bytes. Native temporary copies are operation-specific, removed after sharing and invalidated across account/server changes. |
| Journal CSV | Quote values and neutralize formula-leading cells. Preserve historical captured context/names. |
| Request/logging | Strict schema/media/host/origin/size checks; no-store private responses; redacted request IDs/route groups/status/timing, no bodies or credentials. |
| Public build | No private DB, key, environment file, recovery material, native-dist or source map may enter public assets/deployment traces. |

Photos are resized to fit 1024 pixels, metadata/EXIF stripped, with input pixel/byte bounds and type-signature validation. Provider processing follows the selected provider's separately disclosed policy; “memory-only in FragOut” is not a claim that every possible external provider retains nothing.

Default archive-off, cross-owner access, auth confusion, malformed/oversized images, prompt injection, archive consent races, revoked sessions, publication leaks and credential canaries are covered by the isolated security lab and targeted tests. Use synthetic accounts/keys/images, never user selfies, for attack verification.

The owner previously approved three specific destinations: Production-only Vercel app DB/vault secrets; local/main-only GitHub backup reader/store credentials; and encrypted off-site vault escrow. Those activations were completed and verified. Do not ask for the same approval again when scope is unchanged, and do not stretch it into permission for arbitrary new destinations. Earlier automatic-review rejections were resolved by that explicit approval.

No system is guaranteed unhackable. Report observed controls, exact checks, remaining limits and incident response steps. Do not create new approval flows based on hypothetical risk when the work is already authorized.

## 9. FragDex, sources, photos and layering

### Data and identity

The source catalog is in [catalog](catalog/README.md). Current source JSON confirms 218 full profiles, 241 dupe records and 249 Will It Layer entries. The documented discovery index covers about 1,513 canonical editions; this broader identity search is **not** 1,513 fully researched profiles.

- catalog/fragrances.json: full published profiles.
- catalog/thumbnail-editions.json: additional public editions/identities.
- catalog/reviewed.json, links.json, identity.json: reviewed references and normalization.
- catalog/photos.json: bundled photo provenance, source page/image URL, view/caption/credit.
- catalog/parfumo-images.json and manufacturer-images.json: verified source-specific selections.
- catalog/dupes.json and layering-dupes.json: reviewed original/alternative relationships and maker-declared inspirations.
- catalog/layering.json: imported source pair references, score/check-date metadata.

Treat concentration, flanker and distinguishing release year as identity. Two similarly named releases are not interchangeable. A note pyramid is not a chemical ingredient/allergen statement.

The compiler cross-checks notes across at least two source records and retains stages only when placements agree. The documented source set includes Scento, MySecretCart and Gouttes Rares plus reviewed official/retailer links; check [catalog/README.md](catalog/README.md) for attribution, snapshot reproduction and allowed-use records before importing.

### Ratings and honest gaps

All entries show Overall, Longevity, Projection, Sillage, Scent, Versatility, Value and Bottle rows. N/A is correct when supported data is missing. Existing mapped duration/trail/throw categories are estimates, visibly labeled, linked to their source and kept separate when sources disagree.

The historical profile audit counted 1,089 note claims and 196 wear estimates: longevity in 96 editions, sillage in 83 and projection in 15. These are dated coverage figures, not promises for all catalog identities. The bundled snapshot lacks licensed numeric overall scores for many entries. Exact source links can exist even when the numeric row is N/A.

FRAGOUT_FRAGELLA_API_KEY optionally enables server-side live ratings. Its adapter has fixture verification; do not claim actual live scores are activated until its account/key and a real lookup are verified. Never invent star values from unsupported model opinions.

### Photos

Automatic order: **Parfumo → reviewed official manufacturer → trusted retailer**. The bundled 218-photo registry currently documents 189 Parfumo, 8 official and 21 retained product-page images.

Selection checks exact edition/house/concentration/year, fixed trusted destinations, response limits/types, front/three-quarter view, bottle vs carton and scene suitability. It retries other gallery candidates, cleans accepted JPEGs and retains provenance. Ambiguous source results must not be mislabeled as a verified bottle. New public additions/edits queue lookup; simultaneous saves share work and admin corrections win over pending automatic results.

Normal users do not choose thumbnails. An explicitly granted registered administrator uses **Settings → FragDex photos** to replace, hide, restore or rerun selection. A hidden override must not be resurrected by a fallback. Production admin grants require the database owner's explicit operation; see [docs/CLOUD.md](docs/CLOUD.md#fragdex-admin-access). Local catalog:admin uses the configured local server/database and must not be assumed to grant production access.

Use the existing importers to preserve exact IDs, cleaned files and provenance. Do not indiscriminately download a site's entire gallery/database or reintroduce arbitrary hotlinks. Public accessibility and attribution alone do not establish reuse rights; maintain source/rights review when adding material.

### Layering and dupes

Will It Layer's 249 November 18 sitemap pages supply public pairing identities and source scores. Its described method uses profiles, accords, longevity/sillage, AI and research. **Those imported outputs are AI predictions**, not automatically verified firsthand layering reports. Missing concentration remains explicitly unknown. Imported copy stays on its source site.

The engine keeps evidence tiers separate. Direct brand-supported or approved firsthand evidence can support an evidence-mode pair. The current reviewed brand registry includes Jo Malone Wood Sage & Sea Salt Cologne + Peony & Blush Suede Cologne. Most broader source combinations remain experimental. Dupe adaptation is also a hypothesis; do not transfer the original pair's evidence/score to a substituted pair as if tested.

Premium entries show up to three supported alternatives; recognized alternatives show “Dupe of” even without a complete notes profile. Maker-stated inspiration and community comparison retain different labels. Match the alternative's actual concentration/flanker, and explain substitutions.

Every recommendation still requires owned, distinct bottle variants and applies venue rules, avoided notes, known projection requirements and rejected-pair feedback first. Unknown projection cannot satisfy a strict projection limit. Do not fabricate eligible results when evidence-only mode is empty.

## 10. Production-to-test copy and recovery

See [docs/OPERATIONS.md](docs/OPERATIONS.md) and [src/lib/backups.ts](src/lib/backups.ts).

The user's requirement is one-way production-to-test flow with redundancy. **Test must never write back to production.** The refresh source must be marked production; destination must be a distinct staging SQLite database. Runtime roles cannot rewrite deployment identity markers.

Snapshots use a consistent repeatable-read/read-only transaction, known table/column coverage, bounded pages/rows/bytes, and fail on schema drift. Current durable backup coverage is 11 tables: users, bottles, settings, archive_consents, wear_events, saved_looks, private_photos, ai_credentials, ai_preferences, catalog_admins and catalog_photos. Only confirmed, nonexpiring archived photos are included. Sessions, rate limits, pending selfies, unsaved analyses/recommendations and transient photo attempts are excluded.

Each snapshot is compressed and AES-256-GCM encrypted with a fresh data key; RSA-OAEP-SHA256 wraps it using the public recovery key. The recovery RSA key is 3072 bits. The encryption worker/CI gets the public key only. Vault escrow uses a distinct authenticated payload type.

A backup run checks full isolated restoration, row/binary/foreign-key integrity, uploads ciphertext only to the private Blob store, downloads it to compare SHA-256 and verifies anonymous access is denied. Remote snapshot TTL is seven days; pruning follows verified replacement. Encrypted vault escrow is retained for recovery.

The main-only GitHub environment **production-backups** contains only the dedicated reader URL and backup Blob token, plus a vault key fingerprint variable. It must not contain the raw application vault key or RSA recovery private key. FRAGOUT_BACKUPS_ENABLED was enabled after approval. Workflow [backups.yml](.github/workflows/backups.yml) runs at **06:17 UTC**; the initial successful manual run is [44418997892](https://github.com/RoUchiha/FragOut/actions/runs/44418997892). During this handoff review that remained the latest listed run; do not claim a schedule guarantees a completed daily recovery point.

The initial real production snapshot was empty and was locally/off-site restore-verified. **Never assume the current database is still empty.** Nonempty synthetic backup tests cover private keys/photos as encrypted records, tampering and ownership integrity.

Sanitized refresh creates new IDs and synthetic names/emails, disables working production passwords, omits provider keys/photos/outfits/admin grants/private notes/settings/shelves, and copies only recognized public fragrance identities. Wear logs are rebuilt only for copied owned references and strip private context. Test restarts with its own key and archive off. Refresh atomically replaces test data and invalidates test sessions; stop the owned test server and verify the intended destination before running it.

Operator commands, from the repository, with protected configuration outside Git:

~~~powershell
node --experimental-strip-types scripts/ops.mjs backup
node --experimental-strip-types scripts/ops.mjs verify --file PATH_TO_FRAGBACKUP
node --experimental-strip-types scripts/ops.mjs refresh --file PATH_TO_FRAGBACKUP
~~~

FRAGOUT_OPS_CONFIG or --config can select the protected config. Review its destinations locally without printing secret values. Do not run setup scripts against an existing production database as if it were new.

Disaster recovery is a separately reviewed administrative restore to a fresh database, matching vault recovery material, session revocation, replay of later deletions/consent changes and full readiness/user-flow checks before cutover. Deleted records may remain in encrypted snapshots until expiry. Losing the vault material and decryptable escrow makes saved images/provider keys unrecoverable.

## 11. Local development and private iPhone testing

### Standard development

From the repository with Node 24:

~~~powershell
npm.cmd ci
npm.cmd ci --prefix mobile
npm.cmd run export:web --prefix mobile
npm.cmd run build
npm.cmd run start
~~~

Or use **Start FragOut.cmd**. Local default is loopback http://localhost:3000, mobile at /mobile. For iterative server code use npm.cmd run dev. The mobile browser export must be regenerated when mobile source changes; starting Next alone does not rebuild Expo's exported client.

Local data normally lives at data/fragout.sqlite, or FRAGOUT_DB in an explicitly dedicated private directory. Preserve its credential-key when preserving encrypted records. Never put the data directory under public, generated assets, a shared folder or linked path.

Install/start local Ollama with qwen3-vl:2b-instruct. **Start Qwen.cmd** supports the prepared portable runtime. Weights/binaries live outside Git under the surrounding work/qwen-runtime, not inside a Vercel function. An iPhone's localhost is not the PC's localhost.

### Prepared private test

**Start FragOut Test.cmd** calls scripts/Start-Test.ps1. It serves trusted HTTPS at https://192.168.68.82:3444/mobile with staging SQLite under surrounding work/fragout-test/data. The launcher uses the Windows-current-user DPAPI-wrapped TLS key and only an allowlist of operating-system environment variables, then sets its explicit staging configuration.

Before loading Next, startup refuses .env, .env.local, .env.production and .env.production.local in the checkout. Do not “fix” this by relaxing the guard: Next would otherwise reload cleared production credentials. The test runtime receives neither production secrets nor hosted provider/backup/deployment credentials. It has its own encryption key, TEST label, noindex headers, exact Host/private subnet checks and loopback Ollama.

The PC and phone must share the appropriate private Wi-Fi network. The phone must trust the prepared local CA. The current certificate expires **2026-12-01**; renew and install renewed trust before expiry. Do not bypass a certificate warning or publish a public tunnel.

Background helpers on Windows must launch hidden with Start-Process -WindowStyle Hidden. Identify this checkout's exact scripts/serve-private-test.mjs command line before stopping it for a rebuild. Never stop all node.exe processes or the model indiscriminately.

For trusted HTTPS test scripts on this PC:

~~~powershell
$env:NODE_EXTRA_CA_CERTS=[IO.Path]::GetFullPath('../../work/fragout-iphone/tls/test-root.pem')
$env:FRAGOUT_TEST_URL='https://192.168.68.82:3444'
$env:FRAGOUT_EXPECT_ENV='staging'
node tests/http-operations.mjs
node tests/http.mjs
node tests/http-mobile.mjs
~~~

Do not set NODE_TLS_REJECT_UNAUTHORIZED=0. Plaintext LAN exceptions documented for development are not a production/mobile-release configuration.

## 12. Native release and advertising

### iPhone/TestFlight and Android

Read [mobile/AGENTS.md](mobile/AGENTS.md), [mobile/README.md](mobile/README.md), [docs/APP_STORE.md](docs/APP_STORE.md) and the actual [mobile/eas.json](mobile/eas.json). Fetch Expo SDK 58/current relevant EAS docs before changing native APIs or release commands.

The owner selected **TestFlight**, and Expo sign-in/project setup was performed earlier. The dynamic mobile/app.config.ts already has the owner/project ID; do not create a replacement project just because a new chat lacks local CLI state.

EAS profiles currently include:

- development: development client/internal distribution.
- preview: internal distribution, Android APK, matching SDK 58 images.
- production: store distribution, version auto-increment, Android App Bundle.
- testflight-preview: extends production but uses EAS preview environment, with a matching iOS submit profile.

Set the intended HTTPS API origin as the build environment's public EXPO_PUBLIC_API_URL. This is an address, not a secret. In a private test build do not silently point at production. Expo web always uses its own document origin, regardless of a build-time API URL.

Provider keys and DB/vault credentials must never be EXPO_PUBLIC_ or NEXT_PUBLIC_. Native modules and app configuration require native builds; Expo Go cannot provide the dedicated speech-recognition module or AdMob integration.

Before calling a release “ready to publish,” verify the current signed device build ID, backend, Apple/Google account/signing state, App Store Connect processing/TestFlight availability, physical camera/microphone flows and privacy/listing contacts. Do not equate a simulator app, .hbc export, local IPA filename or EAS build success with an available TestFlight invitation or App Store approval.

Historical iOS simulator acceptance passed five Maestro journeys with a synthetic model on iPhone 17/iOS 26.5/Xcode 26.6: account/FragDex/persistence/deletion, mood/vibe journal, liked combos, typed outfit, gallery/archive opt-out. [Run 43570811595](https://github.com/RoUchiha/FragOut/actions/runs/43570811595) and [report](docs/WEB_IOS_ACCEPTANCE.md) are dated evidence, not a fresh test of later Groq changes.

Current app-funded Groq activation additionally requires the updated consent client. A legacy signed native app must be rebuilt/distributed; it will otherwise get an update-required 409 on Groq photos.

Do not manually create/edit generated ios or android native project directories. Use app.config.ts/plugins and EAS/Expo generation, and expo install for compatible native dependencies. Mobile lint and TypeScript are mandatory after relevant source changes.

### Ads

Native integration is in mobile/src/ads/index.native.tsx, with a web fallback, banner-frame helper and mobile/admob.config.cjs. Home has one inline adaptive banner. An unconfigured/loading/failed slot occupies zero space and cannot receive touches or accessibility focus; never expose an empty clickable ad area.

Enable each platform only with its correct public app/banner IDs, a new native build and the publisher's consent/privacy setup. The SDK uses UMP before non-personalized live requests, and exposes Ad privacy when required. Test mode uses Google's sample IDs. The four FRAGOUT_ADMOB_* variable names and FRAGOUT_ADS_TEST_MODE are in mobile/.env.example.

Production publisher monetization, store ad declarations, app-ads.txt and live-device verification are separate account tasks. Do not enable tracking/personalized ads or invent publisher IDs to make a test pass.

## 13. Verification and evidence

### Reproducible source/build checks

Use checks appropriate to the changed behavior; report exactly what ran. Documentation-only edits need link/path/factual/redaction/diff checks, not newly invented product-test results. Protected GitHub CI may still run the full suite.

~~~powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint --prefix mobile
npm.cmd run typecheck --prefix mobile
npm.cmd run export:web --prefix mobile
npm.cmd run export:native --prefix mobile
npm.cmd run build
~~~

Root npm run verify covers root types/tests/build; it does not replace mobile lint/types/exports. The canonical root build uses **Webpack**, excludes private runtime paths, independently audits public/traced assets and loads an isolated traced API artifact with its OCR dependencies. Do not weaken those checks or substitute an unverified build path.

HTTP journeys against an explicitly selected server:

~~~powershell
$env:FRAGOUT_TEST_URL='http://127.0.0.1:3000'
node tests/http-operations.mjs
node tests/http.mjs
node tests/http-mobile.mjs
node tests/http-discovery.mjs
node tests/http-images.mjs
~~~

Set FRAGOUT_EXPECT_ENV for staging/production operations checks. Choose trusted TLS appropriately. HTTP scripts create disposable accounts and normally clean them up; verify cleanup if a run fails. Avoid parallel production registration storms that unnecessarily consume auth quotas.

The isolated attack lab uses a fresh local DB, synthetic accounts/keys/photos and a loopback model fixture:

~~~powershell
node scripts/security-lab.mjs --test
~~~

It is not permission to attack unrelated hosts. Keep cloud/production secrets out of the lab environment. Local model checks are scripts/check-local-qwen.mjs, check-qwen-photo.mjs and check-qwen-grounding.mjs; run with Node's experimental-strip-types flag as documented.

Focused regressions worth retaining:

- free-qwen.test.ts and hosted-qwen.test.ts: fixed destinations, paid opt-in, no fallback, quotas, invocation tokens, consent and delayed-upload authorization.
- ai-operator.test.ts: pinned CLI, stdin-only secrets, Production-only metadata guard and Sensitive key rotation.
- mobile-ai-consent.test.ts: correct host disclosure and explicit send action.
- private-test-runtime.test.ts and environment/database tests: no inherited credentials or wrong-environment DB access.
- private-looks/photo-lifetime/mobile-session/mobile-export tests: ownership, retention, revocation and temporary artifacts.
- backups.test.ts: complete coverage, schema drift, tampering, restored byte/owner/FK integrity and one-way refresh.
- catalog/photo/layering tests: exact editions, provenance, source restrictions, admin precedence and evidence tiers.

### November 21 model-comparison evidence

Direct layering follow-up: [human report](docs/LAYERING_MODEL_COMPARISON.md), [raw outputs/scoring](docs/evaluations/2026-11-21-layering.json), and [frozen public catalog metadata](docs/evaluations/2026-11-21-layering-catalog.json). New scripts/layering-evaluation.ts, layering-fixtures.mjs and compare-layering.mjs isolate this experiment from production providers. At the November 24 UTC resumption, full suite **325/325**, **13 focused scorer/runner tests** and TypeScript passed. Tests cover selected-bottle eligibility before edition alias normalization, malformed-output failure reporting, metadata redirect rejection, exact notes, duplicate/empty/forced controls, quantity versus eligible-set similarity, citation diagnostics, unfinished/repeat coverage, frozen snapshot integrity and conventional median calculation. The model comparison intentionally fails acceptance (score exits 1); a passing software suite does not reverse that measured failure. Independent review recomputed the frozen data and verified both evaluator fixes; every case, proposal, input hash and primary score is unchanged. No new inference, production writes, paid/hosted/OpenAI API requests, personal data or native runtime changes were made. Recorded local times (median/p95 **19.40/22.93 s**) include partly concurrent source-check load and are not an isolated benchmark. The median is the average of the two middle observations, 19,402.5 ms. The 10.4% Jaccard diagnostic compares eligible returned sets; invalid choices still fail constraints. Integration is guarded by protected [PR 18](https://github.com/RoUchiha/FragOut/pull/18), which carries the exact-head CI outcome. Historical cloud/provider/native checks elsewhere in this file were not refreshed by this offline resumption.

- Full local comparison and sanitized raw outputs: [docs/MODEL_COMPARISON.md](docs/MODEL_COMPARISON.md), [final JSON](docs/evaluations/2026-11-21-vision.json), [valid standalone bottle baseline](docs/evaluations/2026-11-21-standalone-bottles.json) and [actual processing checks](docs/evaluations/2026-11-21-live-provider.json).
- New evaluator/fixture/runner code is in scripts/model-evaluation.ts, model-fixtures.mjs and compare-vision.mjs. Both model inputs are fingerprinted; the session reference is blind. Typed Qwen-route cases use offline rules. Future fresh runs record exact model weights and refuse implicit reuse of old outputs. Review found and regression-fixed stale current-request contracts during inference/resume, re-read OCR evidence drift, execution errors hidden by valid-looking output, and extra garments hidden by coarse normalization. Historical recorded inputs/OCR/scores still match; stronger checks do not change their metrics.
- Fixed singular dress and sweatshirt vocabulary, casual shorts/lapelled-jacket interpretation, explicit no-clothing contradictions, small actually-read OCR connector words, bounded untrusted OCR context for Qwen bottles, and generic concentration-as-name proposals. Real OCR and exact brand/name grounding remain mandatory. OpenAI/Claude transport behavior is unchanged; privacy disclosure now includes the OCR transcript.
- Root suite: **312/312 passed** after review fixes; root TypeScript, mobile lint/TypeScript and root/mobile dependency audits passed (zero advisories). Web and Android/iOS JavaScript/Hermes exports passed. The final web rebuild passed publication checks (11 traces/248 public assets) and isolated OCR/API loading. Private HTTPS passed 30 operational, 20 web, 17 mobile/API and 133 discovery assertions with disposable-account cleanup. An additional authenticated real-Qwen photo run passed 18 mobile/API checks, including export/session/account cleanup. Final restart repeated operational/mobile checks; the final isolated synthetic attack lab passed 173 assertions across 12 groups. Independent review found no remaining issues after fixes, passed 68 focused tests and recomputed all stored metrics/rankings/grounded bottles. Local documentation links and staged Gitleaks passed. Do not interpret exports as a signed phone release.
- Protected [PR 16](https://github.com/RoUchiha/FragOut/pull/16) merged at **2026-11-21 08:39:19 UTC** after both exact-head 80976fd Quality runs passed: [branch 44885607308](https://github.com/RoUchiha/FragOut/actions/runs/44885607308), [PR 44885611321](https://github.com/RoUchiha/FragOut/actions/runs/44885611321). Merged main **905c925b4ae07c18217938053a7c8a8d89f6c1e3** has the identical reviewed tree and [main Quality 44885892192](https://github.com/RoUchiha/FragOut/actions/runs/44885892192) also passed. No branch protection bypass was used.
- Vercel production **dpl_5wseonfRqMEwzeTpA1tspFznzP1v** for that main commit reached READY. At **08:42 UTC**, public health reported revision **905c925b4ae0**, production environment and paidAiEnabled false; readiness/mobile/privacy returned 200 and state/AI-status/looks remained unauthenticated 401. These were **read-only** checks, with no production account creation or model inference. [Redacted public evidence](docs/evaluations/2026-11-21-production.json) records the endpoints. Later documentation deployments may advance the health revision; recheck instead of treating this baseline as permanent.
- At **08:42 UTC**, publication/credential audit found zero exact/encoded known-secret matches across 37 local text assets and 12 referenced live assets/responses; seven private paths returned 404. DB/vault values remain Sensitive and Production-only, absent from cloud test. [Redacted audit](docs/evaluations/2026-11-21-publication-audit.json). Metadata-only recheck also found GROQ_API_KEY, FRAGOUT_GROQ_FREE_CONFIRMED and FRAGOUT_GROQ_ZDR_CONFIRMED absent from Production. No secret values were printed or transferred. This is scoped evidence, not a claim of an unhackable service.
- No OpenAI API call/key, paid enablement, hosted inference, production-data mutation or personal photo was used. Work artifacts are synthetic/public packshots under work/fragout-model-comparison-2026-11-21 outside Git. The initial bottle harness text was wrong and excluded; the valid five-bottle baseline and later same-input OCR-assisted reruns are documented rather than hidden.

### November 19 substantive release evidence (historical baseline)

| Check | Verified result and limit |
| --- | --- |
| Root automated suite | 291 passed for reviewed a327a4a / identical merged tree 601ce95. |
| Root/mobile source | Root TypeScript, mobile lint and TypeScript passed. |
| Bundles | Web, Android and iOS JavaScript/Hermes exports passed; no new signed device publication established. |
| Build publication | 11 traces / 248 public assets; no private DB/key/env/source-map inputs; isolated API/OCR artifact loaded. |
| Private HTTPS | 30 operational, 20 web and 17 mobile/API journeys; final restart repeated operational/mobile. |
| Isolated security | 173 assertions across 12 groups passed with synthetic inputs and no paid provider. |
| Public release | 20 web and 17 mobile/API journeys passed with disposable-account cleanup. |
| Public free-route guard | Paid-user input 400; legacy Groq disclosure 409; correctly disclosed unconfigured model 503; typed outfit 200/offline rules; no saved look, account deleted and session revoked. |
| Credential audit | Zero exact/encoded known credential matches across 37 local text assets and 12 referenced live assets/responses; seven private-file paths returned 404. Existing DB/vault secrets Sensitive/Production-only, absent from cloud test. No Groq key existed yet. |
| Live model | Not performed for Groq because setup was missing. The 348 ms unconfigured synthetic error response is **not inference latency**. |
| Fresh review | Final read-only reviewer found no Critical/Important/Minor issues and independently passed 28 focused tests. |

Passing remote quality evidence: [feature branch](https://github.com/RoUchiha/FragOut/actions/runs/44453130186), [PR](https://github.com/RoUchiha/FragOut/actions/runs/44453138093), [merged main](https://github.com/RoUchiha/FragOut/actions/runs/44453555933).

The public health/readiness endpoints were read again during the November 19 handoff review and both returned 200 for feature baseline 601ce95d42f1, with paidAiEnabled false. Exact current deployment revision advances; recheck instead of treating the stored ID as permanent.

Initial handoff-document verification on November 19 checked **88 local file/heading links**, staged whitespace/diff validity and a redacted Gitleaks scan of all four changed documents; all passed with no leak findings. Repository visibility, remote main, required-check protection and latest quality/backup run metadata were read again. No application code, secret configuration, database or native release was changed by this documentation task. Its PR/CI outcome is discoverable in GitHub rather than fabricated as part of the earlier 291-test release.

Older reports contain real earlier evidence, including browser-engine acceptance and a local Qwen smoke run around 24–28 seconds. Those are not proof of current Groq quality/latency or a fresh physical-iPhone run. A Computer Use attempt on November 18 stopped because it could not confidently verify the Windows browser URL; do not describe that stopped attempt as a completed visual audit or bypass the tool using a browser backchannel.

## 14. GitHub, deployment and rollback

GitHub identity used here is RoUchiha with the matching noreply commit email. Verify current CLI identity before repository operations; do not print tokens. The repository remains public; only code/public assets belong in it.

Main is protected: PR + required **Quality gates** from GitHub Actions, strict/up-to-date checks, enforcement for administrators, linear history and resolved conversations. Force pushes/deletion are blocked. Do not use --admin, disable protections or weaken tests to merge. Security alerts, private reporting, Dependabot fixes and secret-scanning/push protection were enabled during setup; verify before relying on account-level controls.

Workflow [quality.yml](.github/workflows/quality.yml) uses pinned Actions with read-only permissions and installs lockfiles, audits dependencies, checks source, exports platforms, builds/audits the server and exercises synthetic API/privacy flows. No production credentials are required. [ios-acceptance.yml](.github/workflows/ios-acceptance.yml) is a separate manual/macOS simulator workflow, not an automatic TestFlight submission.

Normal change flow:

1. Start from a clean, current main; use a bounded branch and preserve unrelated work.
2. Make code/data/docs changes and update this context together.
3. Run appropriate checks and inspect the diff for secrets/private assets.
4. Commit/push when authorized; create a concrete PR with validation and limitations.
5. Wait for required checks on the **exact final head**, resolve review findings, then merge without bypass.
6. Vercel builds connected main. Confirm intended project/target, READY state, public revision/readiness and relevant user flow after alias assignment.
7. Record deployed/configured/verified outcomes and unresolved operational dependencies here or in the linked report. A README update alone can create a new deployment SHA without changing runtime behavior.

If the GitHub connector lacks repository mutation permission, authenticated gh CLI has worked. Git's credential helper used in this workspace when needed:

~~~powershell
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin YOUR_BRANCH
~~~

Write multi-line PR descriptions to a temporary file outside the repository and use gh --body-file. Never put private records/secret values in the body.

Vercel connector tools are preferred when sufficient. Environment operations previously returned 403 through the connector; the scoped, signed-in CLI/API fallback worked. The operator helper pins CLI 58.4.4 and can use FRAGOUT_VERCEL_CLI pointing to an installed entrypoint. Do not rely on this PC's transient npm cache path in a portable runbook.

Production build configuration in vercel.json installs both lockfiles, exports mobile web and builds the root on Node 24; API region is cle1. Do not promote a credentialless Preview as a substitute for building Production with correct Production-only secrets.

For bad code, roll back to a verified prior Vercel production deployment. Inspect environment compatibility first: older code predating free routing may not understand backend auto. Rollback changes code/traffic, not database data or already changed secret scope. Never use test-refresh as a production restore.

## 15. Known traps and resolved failures

| Symptom / past issue | Lesson to preserve |
| --- | --- |
| API health 500 despite a READY build | OCR-language module packaging and unintended Node major caused a real production failure. Keep Node 24, lazy OCR load, explicit packaged language/core/worker assets and isolated artifact verification. |
| Windows sandbox EPERM during generated build writes | Rerunning the same canonical build with appropriate execution permission succeeded. Do not remove security audits to avoid a filesystem restriction. |
| Private DB discovered in deployment trace | Broad dynamic file paths can pull runtime data into a function bundle. Keep portable trace exclusion plus an independent publication audit. |
| Private test inherited secrets | Clearing env was insufficient because Next could reload .env files. Keep OS-only inheritance and the pre-Next environment-file refusal. |
| OIDC worked in one test but could become stale | Resolve official request-scoped Vercel token for each transport. Preserve invocation rotation tests. |
| Logout/provider switch during OCR | Recheck authorization after OCR/token resolution, immediately before upload; do not swallow 401/409 in bottle fallback. |
| Free failure with paid credential present | Never call Gateway as fallback. Tests deliberately supply an OIDC token while Groq returns 429. |
| Old client labels Gateway but status names Groq | Require the explicit updated-client disclosure marker; simple status echo is insufficient consent. |
| env add --environment production | Unsupported by pinned CLI 58.4.4. Use positional production. |
| env update keeps shared targets | Read undecrypted metadata and refuse nonexclusive Production records before credential stdin. Never assume selecting production narrows an existing variable. |
| Quota test used malformed image bytes | Valid-image quota fixtures and separate malformed-image tests now verify the correct boundaries. Preserve both. |
| HTTPS cookie assertion failed on HTTP CI fixture | Check security properties against the actual transport. Do not weaken HTTPS requirements or fake a production URL in loopback tests. |
| Native simulator session would not persist | Keychain entitlement must be embedded during Xcode build. Simulator signing identity is isolated from distribution signing. |
| Keyboard hid account controls on iOS | Keyboard avoidance moved to the full sheet; keep native regression flows. |
| Catalog/thumbnail promises looked complete | Identity coverage, full profile coverage, supported score coverage and image certainty are distinct. N/A or abstention is safer than fabricated facts/wrong-release photos. |
| Singular “dress” disappeared from clothing input | The old dresses? expression did not match singular dress. A failing regression reproduced it; dress(?:es)? preserves both singular and plural. The November 21 comparison also tests a visible dress and typed dress input. |

If an approval tool rejects an operation, finish unaffected work, report the exact blocked action/reason and seek only the missing authorization. Earlier rejected credential transfers were later explicitly approved for the listed destinations; do not resurrect resolved blockers.

## 16. Priorities and open limitations

Order may change with the user's next request; this list does not independently authorize work.

1. **Activate and verify Groq Free:** owner Free/ZDR/key setup, real synthetic-photo output/retention/latency, verify no paid fallback. Browser/account handoff remains necessary if automation cannot safely reach sign-in.
2. **Current TestFlight/device release:** verify owner Apple/EAS signing state, build/upload the current destination-aware client, provide an actual testing path, exercise front/rear camera, microphone, secure storage, export, archive deletion and provider disclosure on physical iPhone.
3. **Android artifact/device release:** distinguish current APK/AAB build IDs and device acceptance from exported JS.
4. **Broader sourced FragDex coverage:** expand full profiles and supported rating evidence without conflating the larger identity catalog with completed research. Keep image/provenance checks and admin corrections.
5. **Broader reviewed pairing evidence:** retain AI-predicted/dupe-adapted pairs as experimental until independent direct evidence supports promotion.
6. **Managed identity/recovery and operations:** email verification/recovery, monitoring/on-call/capacity objectives, accessibility and load/device acceptance require concrete service/business decisions.
7. **Renew local TLS before December 1:** keep private phone testing functional without bypasses.
8. **Live ads and store metadata:** verify actual publisher/signing/privacy/support/contact settings rather than treating integration source as monetization/store readiness.

Other limits: weather remains manual; no proven complete worldwide fragrance catalog; no OpenAI/Claude OAuth; no unlimited/free hosted capacity guarantee; no enterprise certification/HA/PITR guarantee from Free preview resources. Camera/model recognition can be wrong and requires user review. Existing data-source rights records must be maintained, not assumed perpetual.

Do not casually reopen settled decisions: local test storage, no production-to-test credential copying, paid default off, compact two-tab UI and automatic thumbnails are deliberate user choices.

## 17. Documentation and local artifact index

### Tracked, portable references

| Read for | File |
| --- | --- |
| Normal product use/local start | [README.md](README.md) |
| Environment/backup/recovery/AI operations | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Initial production activation history | [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) |
| DB roles/migrations/cloud/admin | [docs/CLOUD.md](docs/CLOUD.md) |
| Catalog methodology/commands/photo admin | [catalog/README.md](catalog/README.md) |
| Mobile run/release/ads | [mobile/README.md](mobile/README.md), [docs/APP_STORE.md](docs/APP_STORE.md) |
| Privacy/session/security evidence | [docs/SECURITY_REPORT.md](docs/SECURITY_REPORT.md) |
| Historical web/iOS/model acceptance | [docs/WEB_IOS_ACCEPTANCE.md](docs/WEB_IOS_ACCEPTANCE.md), [docs/ACCEPTANCE_REPORT.md](docs/ACCEPTANCE_REPORT.md) |
| November 21 local Qwen / blind 6.1 Sol comparison | [docs/MODEL_COMPARISON.md](docs/MODEL_COMPARISON.md), [docs/evaluations](docs/evaluations/2026-11-21-vision.json) |
| Direct layering proposals, same models | [docs/LAYERING_MODEL_COMPARISON.md](docs/LAYERING_MODEL_COMPARISON.md), [docs/evaluations/2026-11-21-layering.json](docs/evaluations/2026-11-21-layering.json) |
| Parfumo workflows and verification | [docs/PARFUMO_RESEARCH.md](docs/PARFUMO_RESEARCH.md), [docs/PARFUMO_VERIFICATION.md](docs/PARFUMO_VERIFICATION.md) |
| Bottle source investigations | [docs/PARFUMO_IMAGES.md](docs/PARFUMO_IMAGES.md), [docs/MANUFACTURER_IMAGES.md](docs/MANUFACTURER_IMAGES.md) |
| Latest free-route implementation plan | [docs/superpowers/plans/2026-11-18-free-vision-switch.md](docs/superpowers/plans/2026-11-18-free-vision-switch.md) |
| Original supplied baseline | [docs/original-spec/README.md](docs/original-spec/README.md); reference only, pre-implementation status is historical |

**Known documentation drift to handle carefully:** older README/report paragraphs still mention 191/269 tests, local-only Qwen or initial activation holds. CLOUD/APP_STORE/mobile guides include old Ollama-production assumptions. Those passages are historical/superseded by the current routing implementation, operations runbook and this context. Plans can contain unfinished checkboxes after their code shipped. Do not use a stale checklist as proof of current failure or current completion; inspect code and dated evidence. Update the affected guide when touching its subject.

### Local-only artifacts on the prepared PC

These paths describe where operator material exists, **not permission to print, copy, commit or redistribute it**. They are not present in a normal clone.

| Surrounding workspace path | Purpose / handling |
| --- | --- |
| work/fragout-ops/free-vision-report.md | Detailed final free-route release report; redacted operational evidence. |
| work/fragout-ops/free-production-verification.json | Live release/paid-off/typed-input/consent/fail-closed result and disposable-account cleanup. |
| work/fragout-ops/credential-audit.json | Redacted known-credential/publication/scope results. |
| work/fragout-ops/github-backup-verification.json | First real backup-job/recovery evidence. |
| work/fragout-ops/private/operator.json | Protected operator config; may reference credentials and recovery paths. Never output wholesale. |
| work/fragout-ops/private/reader.json | Contains the private reader connection URL. Never print/upload/commit. |
| work/fragout-ops/private/blob.env | Private backup-store token. Never load into the application/test runtime. |
| work/fragout-ops/recovery/recovery.pem | RSA recovery PRIVATE key. Never send to hosting/CI or commit. Preserve owner-controlled offline recovery separately. |
| work/fragout-cloud/private/connection.env | Existing production DB/vault material. Never output, bundle or place in the repo's .env files. |
| work/fragout-test/data and logs | Local staging DB/key and private server logs. Not test fixtures to publish. |
| work/fragout-iphone/tls | Public test CA/certificate metadata plus DPAPI-wrapped private server key; not portable to another Windows user. |
| work/qwen-runtime | Portable Ollama/model data, loopback runtime, local smoke fixtures; not source assets. |
| work/fragout-web-ios, fragout-acceptance, fragout-app-store | Historical evidence/build workspace; verify dates and revision before reusing artifacts. |

Local operator audit/verification scripts outside Git can help on this machine, but a portable handoff must rely on tracked code, protected owner configuration and evidence links. Never assume an old scratch script's assertions reflect the current live state.

## 18. Decision history and handoff journal

Keep this short and useful. New entries should record decisions/outcomes, not a transcript of tool calls.

| Date / milestone | Result and enduring lesson |
| --- | --- |
| November 2026 product iterations | Mobile-first compact Home/Find-a-scent interface, mood/vibe, outfit review, private looks, liked pairs, source-linked FragDex/ratings/dupes, automatic thumbnails and admin corrections. |
| November 13–14 acceptance | Historical multi-engine web checks, local-model grounding and five iOS simulator journeys passed; physical-device/store release remains distinct. |
| November 18 Parfumo/Will It Layer | Added database-first discovery, filters/profiling/shelves/comparison/journal and public pair references; preserve transparent evidence tiers and exact edition identity. |
| November 18 photo changes | Latest preference is Parfumo then official manufacturer then trusted retailer; bundled 218 images have source attribution. No separate photo-gallery/user-selection feature. |
| PR [#1](https://github.com/RoUchiha/FragOut/pull/1), code 45f226c | Production build packaging, environment isolation, one-way sanitized refresh, encrypted verified recovery and protected quality gates. Specific credential destinations were later approved/activated. |
| PR [#13](https://github.com/RoUchiha/FragOut/pull/13), code 8a10724 | Production hosted Qwen through invocation-scoped OIDC, private routing, exact cloud consent and late authorization checks. Credits were not purchased. |
| PR [#14](https://github.com/RoUchiha/FragOut/pull/14), code 601ce95 | Free Groq adapter + default paid-off switch, protected owner setup, Production-only scope guard and updated-client disclosure marker. 291 tests and Linux/public/private checks passed; live Groq activation still awaits owner account/key/ZDR. |
| 2026-11-19 UTC handoff documentation | Owner requested a full maintained context for all future chats. Added this authoritative file, root AGENTS/CLAUDE discovery instructions and README pointer. Re-read source/runbooks, confirmed public repository/main, passing feature CI and initial backup run, and public production health/readiness 200 with paid off. Application behavior unchanged; documentation verification belongs to this change, prior runtime evidence remains dated above. |
| 2026-11-21 model comparison | Compared actual local 2B Qwen with blind 6.1 Sol on 15 images/four typed descriptions. Raw Qwen had bottle/abstention failures; targeted parser, OCR and validation fixes make the checked app pass this small corpus, including 14/14 recommendation comparisons. Preserved weak raw results and documented phased reruns, limits and CPU timing. Independent review prompted broader format-only exclusion and benchmark-integrity fixes; 312 tests pass. Source/build/bundle checks, private HTTPS journeys (including real-Qwen photo upload) and 173 isolated security assertions pass. PR 16 passed protected CI and merged as 905c925; main Quality passed and that Vercel production release was verified READY/read-only healthy at 08:42 UTC. Public credential audit clean. Hosted 27B remains unconfigured/untested; paid flag, provider credentials and production data unchanged. Details/evidence in section 13. |
| 2026-11-21 direct layering follow-up | User asked both models for actual layering choices across scenarios. Fourteen blind, identical-input cases plus two local repeats failed the predeclared raw-similarity criterion: 12.5% shared slots and Qwen abstention 0/3 versus Sol 3/3. Preserved raw failures, examples, supplied-note formatting versus grounding distinctions and exact weights/snapshot. Added offline tools/nine focused regressions; 321 software tests and types pass. Production recommendation engine, credentials and paid/native configuration unchanged. Stronger hosted model needs its own fixed-corpus evaluation after protected setup. |
| 2026-11-24 UTC layering review/integration | Resumed after the prior automatic approval service hit an account usage limit; publication proceeds through protected PR 18. Independent review reproduced selected-alias eligibility and malformed-output reporting bugs in the offline evaluator; fixed with red-green regressions, plus metadata redirect rejection and conventional even-sample median. Qualified Jaccard as eligible returned-set comparison. Full 325 tests, 13 focused tests, types and 117 local documentation links pass. Final independent review approved with no remaining findings; all original model inputs/proposals/case scores and the failed 12.5% similarity result remain unchanged. No model rerun or application behavior/configuration change. |

### Completion checklist for future handoffs

- [ ] Current user request and any accepted corrections are reflected in this file.
- [ ] Affected architecture, commands, configuration and source contracts match the actual code.
- [ ] No secret value, private user data or unsafe sample credential was added.
- [ ] Verification results identify their revision/environment and distinguish mocks, local model, hosted inference, simulator and physical device.
- [ ] Git/PR/CI/deployment status is accurate, with remaining blockers and next actions.
- [ ] External changes and any new owner dependencies are recorded.
- [ ] Obsolete current-state claims are replaced; useful old evidence is clearly historical.
- [ ] The user receives a concise outcome and can find this file in the repository.

Suggested prompt for the next chat:

> Continue FragOut in RoUchiha/FragOut. Read AGENTS.md and PROJECT_CONTEXT.md first, verify current Git/deployment state, preserve the paid-off and privacy/environment-isolation rules, and update PROJECT_CONTEXT.md with every change. Resume the next task I give you; do not assume unfinished account activation or TestFlight delivery has already happened.
