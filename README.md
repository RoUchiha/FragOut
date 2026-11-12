# FragOut

A compact fragrance wardrobe app. The primary interface is an Expo / React Native app for iOS and Android, with a matching browser preview. The desktop companion and API can run locally or on a Node.js host.

## Open it

[Open the mobile preview](http://localhost:3000/mobile). The [desktop companion](http://localhost:3000) remains available.

On Windows, double-click **Start FragOut.cmd** to start the app later. Node.js 24+ is required. The launcher installs missing dependencies and builds the mobile preview and backend if needed. Keep its terminal open while using the app.

For a fresh checkout:

```powershell
npm.cmd ci
npm.cmd ci --prefix mobile
npm.cmd run export:web --prefix mobile
npm.cmd run build
npm.cmd run start
```

The server binds to loopback. See the mobile guide for phone connections, compatibility checks, and signed store builds. [Mobile guide](mobile/README.md)

## Mood and vibe

In the mobile app, the home icon opens your collection, bottle scanning and Add. The lightbulb opens **Find a scent**, with compact picks beneath its search bar. Type a cue such as **tired clean work**, or search by fragrance, house or note. Open **Filters** to choose mood, vibe, occasion or pairs. **Match outfit** opens the photo, text and dictation flow.

The mobile palette follows the device's local time and the hemisphere in **Settings → Conditions**. Each season has morning, day, evening and night variations.

Matches use the notes and families you recorded for owned bottles. Your desired vibe has more influence than mood. Venue rules, exclusions and pair evidence still apply. Tap a suggestion to see the matching note or family. Wear logs and saved looks keep the choices from the recommendation.

## Outfit matching

1. Choose **Match outfit**, **Take selfie**, or a gallery photo. You can also type a description or dictate it.
2. Review the clothing description. **Edit details** opens garments, colors, style, formality and palette when needed.
3. Confirm the outfit, select an occasion, and request a fragrance, pair, or both.
4. The engine uses only owned bottles with known profiles, applying venue rules and exclusions before outfit style. Wear a choice or save a pair to the journal.

Outfit style is a heuristic, not measured fragrance compatibility. The model interprets clothing; it never chooses arbitrary catalog IDs or creates pair evidence. Experimental pairs require deliberate opt-in and remain labeled untested. Unknown scent profiles stay unknown.

The mobile collection reads bottle labels through the selected vision provider and presents up to three candidates. Confirm the exact house, edition and concentration before adding.

## FragDex

Save a fragrance or tap one in Collection to open FragDex. It matches the exact house, release and concentration against a local reference catalog. Tap the bottle thumbnail to enlarge it when a reviewed photo is available. Profiles show cross-checked notes and five-star ratings where evidence is available. Tap a score to open its source in a browser sheet. Fragrance and retailer links sit below the ratings.

The catalog includes 218 exact editions with corroborated notes and one bundled bottle photo per edition. When a saved public edition needs a photo, FragDex automatically checks product listings for an exact match. Unsupported rating facets show **N/A**. A server-side Fragella developer key enables live overall ratings and additional supported estimates for signed-in users. See the [photo lookup, admin setup and catalog sources](catalog/README.md).

## Free default, optional personal providers

**Qwen3-VL 2B Instruct through Ollama is the default.** It runs on the backend computer/server, not on the phone. There is no API fee; it still needs hardware, disk space and a running server. The first download is approximately 1.9 GB.

Install [Ollama](https://ollama.com/download), then:

```powershell
ollama pull qwen3-vl:2b-instruct
ollama serve
```

If Ollama is already running, skip `serve`. **Start Qwen.cmd** can start an installed Ollama or the portable runtime prepared beside this workspace. Model weights and runtime binaries are deliberately excluded from the source archive. This workspace's portable model data is under `work/qwen-runtime`, two directories above this project.

In mobile **Settings → Model connection**, users can connect their own OpenAI or Claude API key and select that provider. These are API-key connections; OAuth and chat-subscription login are not implemented. Keys are encrypted per user on the backend. They never enter the app bundle or exports. Key entry requires HTTPS or a loopback connection. Signing into the mobile preview on the backend computer also allows connecting a key for that same account on the phone.

Photos/descriptions go only to the explicitly selected provider. The server rejects analysis if that selection changed after the screen loaded. There is no automatic paid fallback. Provider API charges belong to the user's account; a ChatGPT or Claude chat subscription is separate from API access. Users can test, switch, replace or disconnect a connection. Disconnecting the active paid connection returns to Qwen.

If Qwen is unavailable, typed descriptions can use clearly labeled offline clothing rules. Photos never receive a fabricated offline result. OpenAI/Claude adapters were verified with fixtures; live paid inference was not tested with a real key. Local Qwen text and image calls were tested.

Optional backend settings are documented in `.env.example`, including a dedicated private data directory and the explicit HTTPS public origin. A model override must support images and the structured contract.

## Collection and wearing

- Exact house/name/concentration identity; duplicate bottles; owned/wishlist/not-owned status; favorites, private notes and personal scent profiles. Identity changes clear the old variant's scent traits.
- Deterministic everyday, gym, date, work, party and errands recommendations. Fragrance-free venues, avoided notes, projection limits and unknown-profile exclusions take priority.
- Evidence-only pairing by default; honest empty results when no reviewed records exist. Explicit experimental pairs contain two distinct owned variants and no fabricated citations.
- Private wear journal, saved pairs and feedback. Rejecting a pair does not downgrade either bottle individually. Server-owned recommendation snapshots preserve the wearing occasion.
- Private local registration/login, account export and deletion. New real accounts start empty. The demo is an isolated seven-day account with six owned fictional scents and two wishlist examples.
- The desktop companion additionally exposes detailed manual conditions, custom occasion shortcuts, educational pages and collection controls.

## Photos, keys and account data

Native bearer sessions use origin-bound SecureStore envelopes; the browser preview keeps its token in memory and stays on its own origin. Signing out clears active credentials immediately; old responses and exports cannot install or share another account's data. The companion uses HttpOnly SameSite cookies, automatically Secure with a `__Host-` name on HTTPS. Passwords use salted scrypt hashes. Sessions are hashed at rest and expire in seven days. Owner isolation applies to bottles, settings, journal, model connections, outfit receipts, saved looks and photos.

**Archiving is off by default.** Default selfies are processed in memory without backend photo storage. App-owned picker files and previews are removed when the selfie is submitted, including when analysis fails. Bottle scan copies are removed after label reading, before the user confirms the exact identity and adds the bottle. New scan suggestions require an accuracy confirmation. Gallery originals are retained. Startup/session changes also sweep known app-owned orphan files and revoke browser photo URLs.

Enable **Settings → Photo privacy → Archive outfit-fragrance looks** to keep selected looks. Sanitized photos are held encrypted for up to 15 minutes while reviewing; only **Archive look** attaches a photo to the confirmed fragrance/pair. Journal → Saved looks reads photos through authenticated endpoints, never public image URLs. Delete a look to remove its photo. Turning archiving off atomically deletes all saved looks/photos, removes recommendation clothing copies, and invalidates previous upload consent even after a rapid off/on toggle.

Unsaved clothing descriptions and their recommendation copies expire after 15 minutes. The local server purges expired data on access and on a timer. Hosted FragOut also runs scheduled cleanup in Postgres. Saved looks remain until deletion or archive opt-out. Export includes the full journal, current descriptions and saved-look metadata, without passwords, tokens, provider keys or photo bytes. Native export copies use separate operation filenames, are removed after sharing, and cannot continue across account/server changes.

Images are resized and stripped of EXIF before reaching the selected model. Qwen requests unload their local model context after use. OpenAI requests use `store:false`; cloud processing still follows the provider's separate retention policy. Speech recognition uses the device/browser service; FragOut receives the transcript, not a recorded audio upload.

Local FragOut uses SQLite at `data/fragout.sqlite`. Use a dedicated data directory. Startup rejects unrelated files and links and restricts permissions to the service user plus Windows SYSTEM and Administrators, or 700/600 on POSIX. Provider credentials and archived photos use AES-256-GCM with separate keys and owner-bound authentication. Preserve the installation key securely with your backups. The current account flow uses a password without email verification or recovery.

Hosted FragOut uses a private Postgres schema with the same sign-in and data controls. Use the dedicated database role, a stable server-only vault key, and the host's HTTPS URL. [Cloud setup and deployment](docs/CLOUD.md)

## Verification and limits

See the [12 November 2026 acceptance report](docs/ACCEPTANCE_REPORT.md) for the browser, Android, API, photo, and cloud checks.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run typecheck --prefix mobile
npm.cmd run export:web --prefix mobile
npm.cmd run export:native --prefix mobile
# With the backend running:
node tests/http.mjs
node tests/http-mobile.mjs
# Isolated attack lab: synthetic accounts, images, keys and local model stub only
node scripts/security-lab.mjs --test
# With the isolated lab running separately (default port 3210):
node tests/http-intent.mjs
# Optional real local-model smoke checks:
node --experimental-strip-types scripts/check-local-qwen.mjs
node --experimental-strip-types scripts/check-qwen-photo.mjs
```

The current build passed 128 tests, 7 mood and vibe HTTP checks, 173 security assertions and 37 existing HTTP checks. Production builds also check deployment traces and public assets for private files. Browser and native bundle checks run separately. See the [security assessment](docs/SECURITY_REPORT.md), [original mobile verification](docs/MOBILE_VERIFICATION.md) and [mobile build instructions](mobile/README.md).

Remaining production work includes signed phone builds and device acceptance, broader catalog evidence and photo coverage, a reviewed pair evidence registry, measured recommendation/vision quality, live weather, managed identity/recovery, HTTPS hosting, operational review and a full accessibility audit. Use a persistent single-host Node process for the local database. This build runs locally.

Provider references: [Ollama chat API](https://docs.ollama.com/api/chat), [Qwen model](https://ollama.com/library/qwen3-vl:2b-instruct), [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses), [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
