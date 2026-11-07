# FragOut

A compact fragrance wardrobe app. The primary interface is an Expo / React Native app for iOS and Android, with a matching browser preview. The desktop companion and API run on this computer.

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

The server binds to loopback. It is not a hosted service. See [the mobile guide](mobile/README.md) for running on a physical phone, development-network setup, and signed native builds. Native iOS/Android code exports have been compiled; an installable, signed APK/IPA and physical-device acceptance are still required.

## Outfit matching

1. Choose **Match outfit**, **Take selfie**, or a gallery photo. You can also type a description or dictate it.
2. Review the clothing description. **Edit details** opens garments, colors, style, formality and palette when needed.
3. Confirm the outfit, select an occasion, and request a fragrance, pair, or both.
4. The engine uses only owned bottles with known profiles, applying venue rules and exclusions before outfit style. Wear a choice or save a pair to the journal.

Outfit style is a heuristic, not measured fragrance compatibility. The model interprets clothing; it never chooses arbitrary catalog IDs or creates pair evidence. Experimental pairs require deliberate opt-in and remain labeled untested. Unknown scent profiles stay unknown.

The mobile collection also reads bottle labels through the selected vision provider and presents up to three uncertain suggestions. Users confirm the exact house, edition and concentration before adding. Scent facts are not inferred from a label. Real catalog data remains manual; the demo contains original fictional fragrances.

## Free default, optional personal providers

**Qwen3-VL 2B Instruct through Ollama is the default.** It runs on the backend computer/server, not on the phone. There is no API fee; it still needs hardware, disk space and a running server. The first download is approximately 1.9 GB.

Install [Ollama](https://ollama.com/download), then:

```powershell
ollama pull qwen3-vl:2b-instruct
ollama serve
```

If Ollama is already running, skip `serve`. **Start Qwen.cmd** can start an installed Ollama or the portable runtime prepared beside this workspace. Model weights and runtime binaries are deliberately excluded from the source archive. This workspace's portable model data is under `work/qwen-runtime`, two directories above this project.

In mobile **Settings → Model connection**, users can connect their own OpenAI or Claude API key and select that provider. Keys are encrypted per user on the backend. They never enter the app bundle or exports. Key entry requires HTTPS or a loopback connection. Signing into the mobile preview on the backend computer also allows connecting a key for that same account on the phone.

Photos/descriptions go only to the explicitly selected provider. The server rejects analysis if that selection changed after the screen loaded. There is no automatic paid fallback. Provider API charges belong to the user's account; a ChatGPT or Claude chat subscription is separate from API access. Users can test, switch, replace or disconnect a connection. Disconnecting the active paid connection returns to Qwen.

If Qwen is unavailable, typed descriptions can use clearly labeled offline clothing rules. Photos never receive a fabricated offline result. OpenAI/Claude adapters were verified with fixtures; live paid inference was not tested with a real key. Local Qwen text and image calls were tested.

Optional backend settings are documented in `.env.example`: `FRAGOUT_DB`, `FRAGOUT_OLLAMA_URL`, `FRAGOUT_QWEN_MODEL`, `FRAGOUT_VAULT_KEY`, and HTTPS cookie configuration. A model override must support images and the structured contract.

## Collection and wearing

- Exact house/name/concentration identity; duplicate bottles; owned/wishlist/not-owned status; favorites, private notes and personal scent profiles. Identity changes clear the old variant's scent traits.
- Deterministic everyday, gym, date, work, party and errands recommendations. Fragrance-free venues, avoided notes, projection limits and unknown-profile exclusions take priority.
- Evidence-only pairing by default; honest empty results when no reviewed records exist. Explicit experimental pairs contain two distinct owned variants and no fabricated citations.
- Private wear journal, saved pairs and feedback. Rejecting a pair does not downgrade either bottle individually. Server-owned recommendation snapshots preserve the wearing occasion.
- Private local registration/login, account export and deletion. New real accounts start empty. The demo is an isolated seven-day account with six owned fictional scents and two wishlist examples.
- The desktop companion additionally exposes detailed manual conditions, custom occasion shortcuts, educational pages and collection controls.

## Photos, keys and account data

Native bearer sessions use SecureStore; the browser preview keeps its token in memory. The companion uses HttpOnly SameSite cookies. Passwords use salted scrypt hashes. Sessions are hashed at rest and expire in seven days. Owner isolation applies to bottles, settings, journal, model connections and outfit receipts.

Photos are resized, stripped of metadata and processed temporarily. They are not written to the backend database. Temporary app picker copies are discarded after success, removal or screen exit; originals in the user's library are retained. Speech recognition uses the device/browser service; FragOut receives the transcript, not recorded audio. See device/provider policies for their processing and retention.

Structured outfit descriptions expire after 24 hours and are purged on the next API activity or startup. Expired descriptions cannot be read, recommended from or exported. Recommendation snapshots are pruned on startup. Real account data remains until deletion. Export includes the full journal and unexpired descriptions, without passwords, tokens, provider keys or photos.

The SQLite database is `data/fragout.sqlite`. Its ordinary account data is not encrypted at rest. Provider credentials use AES-256-GCM and a separate generated `data/credential-key`, or an installation key supplied through `FRAGOUT_VAULT_KEY`. Preserve that key securely with database backups; changing it makes existing provider connections unreadable. People with filesystem access are outside the app's account boundary. Deletion removes active records, not backups or forensic traces in SQLite free pages. This local edition has no email verification or password recovery.

## Verification and limits

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
# Optional real local-model smoke checks:
node --experimental-strip-types scripts/check-local-qwen.mjs
node --experimental-strip-types scripts/check-qwen-photo.mjs
```

See [verification evidence](docs/MOBILE_VERIFICATION.md) and [mobile build instructions](mobile/README.md). Automated checks cover ownership, exclusions, evidence tiers, encrypted connections, native sessions, temporary image validation and expiry. The browser flow is tested separately from native code compilation. A synthetic outfit image establishes a working integration, not a photo-accuracy benchmark.

Remaining production work includes signed phone builds and device acceptance, licensed real catalog/variant research, a reviewed pair evidence registry, measured recommendation/vision quality, live weather, managed identity/recovery, HTTPS hosting, operational review and a full accessibility audit. The local database requires a persistent single-host Node process; it is not suitable for an ephemeral serverless filesystem. No app-store or web publication was performed.

Provider references: [Ollama chat API](https://docs.ollama.com/api/chat), [Qwen model](https://ollama.com/library/qwen3-vl:2b-instruct), [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses), [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
