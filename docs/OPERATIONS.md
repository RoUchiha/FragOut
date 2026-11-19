# FragOut operations

## Environments

| Environment | Runtime and storage | Access |
| --- | --- | --- |
| Production | `fragout-wardrobe` Vercel project; existing private Supabase `fragout` schema | HTTPS and owner-scoped app sessions. Runtime requires production-only database/vault secrets. |
| Local test | `https://192.168.68.82:3444/mobile`; separate SQLite database under `work/fragout-test/data` | Private Wi-Fi interface/subnet, exact Host validation, HTTPS, app sign-in. Marked TEST. |
| Backup operations | Separate `fragout-backups` project and private Blob store in `iad1` | No app deployment; backup storage credentials are excluded from production and test runtimes. |
| Reserved cloud test | `fragout-test` Vercel project | All deployment URLs protected by Vercel authentication; no database connected. The user chose local test storage. |

The local address applies to this prepared workspace. It requires the PC and phone to share Wi-Fi and the existing iPhone preview CA profile. Its current certificate expires 2026-12-01. Renew through the local preview certificate preparation procedure before expiry and install the renewed trust profile on the phone. Do not bypass certificate warnings or expose this local test port through a public tunnel.

Double-click **Start FragOut Test.cmd** after building to start the test server. `scripts/Start-Test.ps1` reads the local TLS key through Windows DPAPI; the Node process inherits only required operating-system settings, then sets its explicit test configuration. Startup refuses repository environment files before Next can reload them; keep secrets in the protected operator directory outside the checkout. The test app uses its own local encryption key. The free Qwen model runs separately on loopback with cloud use disabled. Stopping the PC stops this local test environment.

`GET /api/health` checks API module liveness. `GET /api/ready` checks storage and deployment identity and returns 503 during a storage outage or wrong-environment connection. Every API response carries a server-generated request ID. Access logs, when enabled, contain route groups, status and timing rather than URLs, queries, account IDs, bodies or tokens.

## One-way refresh

The source database is marked `production`; the destination must be a separate SQLite instance marked `staging`. Runtime roles cannot alter these markers. The `fragout_backup_reader` role has SELECT permissions and no INSERT/UPDATE/DELETE or administrative permissions. Its default transactions are read-only. The test runtime never receives this role's connection string.

The operator snapshot uses a consistent repeatable-read transaction. It covers the known schema, reads bounded pages, and fails on schema drift, excessive rows or excessive bytes. The production key is not needed to read encrypted records. A separate encrypted escrow supports later key recovery.

```powershell
# Configuration paths reference protected files outside this repository.
node --experimental-strip-types scripts/ops.mjs backup
node --experimental-strip-types scripts/ops.mjs verify --file PATH_TO_FRAGBACKUP
node --experimental-strip-types scripts/ops.mjs refresh --file PATH_TO_FRAGBACKUP
```

Refresh is an atomic replacement of test data. It invalidates test sessions. Users get new IDs, synthetic names/emails and no working production password. Only recognized public fragrance identities are copied; custom labels are omitted. Private notes, shelves, location/settings, provider keys, images, saved outfits, sessions and administrator grants are omitted. Settings restart with archiving off and the free provider. Wear records are rebuilt only for copied bottles, with private notes/context removed. Production is never an import destination.

The initial copy was based on a single management-connector inventory proving every durable production table empty. The `--empty-inventory` path rejects any nonempty table; it is not a substitute for configuring the separately authorized reader for ongoing snapshots.

## Backup and recovery

Snapshots include durable account, collection, journal, encrypted provider and archived-look records, plus shared catalog overrides. Sessions, rate limits, temporary recommendations, unsaved outfit analyses and pending selfies are deliberately excluded. A backup restore must not resurrect short-lived login or photo state.

Each payload is compressed and encrypted with a fresh AES-256-GCM key. RSA-OAEP-SHA256 wraps that key for the separate recovery key, with metadata authenticated as additional data. The current RSA key is 3072 bits. The worker can encrypt with the public key and has no private recovery key. The vault escrow uses a separate authenticated payload type and cannot be opened as a database snapshot.

The operator verifies a full restore in an isolated in-memory database, including row values, binary fields and foreign keys. It then writes an encrypted local file, uploads only ciphertext to private Blob storage, downloads it again to compare SHA-256, and verifies anonymous access is denied. No snapshot or secret enters a public repository, public asset directory or GitHub Actions artifact.

Database snapshots have seven-day remote TTL and local/remote pruning after a verified replacement. The encrypted vault escrow is retained for recovery. Deleted account/archive data may remain in encrypted snapshots until the retention window expires; operators must replay subsequent deletion/consent changes after a disaster restore. Recovery keys must be preserved separately, including an owner-controlled offline copy. Losing both the vault material and its decryptable escrow prevents recovery of archived images and connected keys.

The owner specifically approved the production-only application secrets, local/main-only GitHub reader and backup-store credentials, and private off-site encrypted vault escrow. All three are activated. The reader has LOGIN with SELECT-only grants and no administrative or write privileges. The escrow has authenticated checksum read-back and anonymous HTTP 403. The daily GitHub workflow is enabled at 06:17 UTC; its first manual [GitHub run passed](https://github.com/RoUchiha/FragOut/actions/runs/44418997892). This is verified automation, not a guaranteed recovery point or availability SLA.

## Hosted photo analysis

Production defaults to `FRAGOUT_QWEN_BACKEND=auto`: Qwen3.8 27B through the fixed Groq HTTPS endpoint while `FRAGOUT_PAID_AI_ENABLED` is absent or false. A legacy `gateway` preference cannot bypass the paid-off flag. Local test startup strips all hosted flags and credentials and keeps using local Ollama. No provider key is exposed through app metadata or client bundles.

For free activation, create a dedicated Groq **Free** account/key without adding a payment method. Enable **Zero Data Retention** in its Data Controls, then run the protected owner setup locally:

```powershell
pwsh -NoProfile -File scripts/Configure-Free-AI.ps1
```

It asks for explicit Free/ZDR confirmations and a hidden key. It verifies model access without a photo request, stores `GROQ_API_KEY` as a Sensitive Production-only Vercel variable, records `FRAGOUT_GROQ_FREE_CONFIRMED=true` and `FRAGOUT_GROQ_ZDR_CONFIRMED=true`, turns paid hosting off, and redeploys. It sends the key through stdin, never a command argument or file. Before each write, it reads undecrypted scope metadata and refuses matching shared, Preview, Development, custom or branch-scoped variables. Review any such record in Vercel before retrying; the command does not broaden credential scope. The adapter fails closed until all three values exist. The documented inference API does not independently prove Free billing status or organization ZDR; these are operator attestations. Reconfirm them after any provider-account change, and remove the flags to suspend uploads if settings are uncertain. See [billing](https://console.groq.com/docs/billing-faqs), [limits](https://console.groq.com/docs/rate-limits) and [data controls](https://console.groq.com/docs/your-data). Free quotas and service availability can change.

Only the operator can enable the separate app-funded paid route:

```powershell
npm run ai:paid -- off
npm run ai:paid -- on
# Preview either action without changing configuration:
npm run ai:paid -- off --dry-run
```

These commands require Vercel operator sign-in, target only the production app, verify release support, update server configuration, and redeploy the current published source. Off takes effect when that deployment is ready; it does not cancel already-running requests. On selects the existing Gateway route with request-scoped deployment OIDC and privacy-restricted Wafer/Parasail routing. Commands do not purchase credits, upgrade a plan or enable auto-reload. Keep paid off unless a separate budget is authorized and the paid route is tested. The existing project Gateway budget is $5/month; request-boundary budgets are not an exact spending cap. User-connected OpenAI/Claude choices remain explicit user-funded providers, separate from this operator switch.

Hosted photo requests require a current destination/model/policy consent receipt. Session, destination and selected-provider authorization are checked again immediately before transport, after OCR and token resolution. Responses are schema-validated; prompts prohibit fragrance facts and personal inference, and users review clothing details. Recommendations still use owned fragrances and grounded evidence. Typed Qwen descriptions use local rules. Default photos remain memory-only; the separate archive-confirmation flow governs retained photos. Provider policies also govern operational metadata and any permitted transient processing.

Free hosting allows two photo requests per installation per minute and 50 per fixed 24-hour window; paid hosting allows 150 per installation per fixed day. Both allow ten hosted photo requests per user per fixed day plus eight analysis requests per user per minute. Fixed windows start at the first request and are not rolling guarantees; provider token/rate quotas may reject earlier. Quota and provider failures never invoke paid fallback, relax privacy filters, or borrow a user's API key. A descriptive error offers typed outfit input, which works without hosted inference.

## CI, release and rollback

Quality gates install pinned lockfiles on Node 24.16.0, audit dependencies, run root tests/TypeScript and mobile lint/TypeScript, export all platforms, build the server, exclude private runtime paths, audit publication boundaries, load an isolated traced API artifact, and exercise synthetic HTTP/privacy flows. No production credentials are needed for these checks. Actions are pinned by commit; job permissions are read-only.

Production should receive only commits whose **Quality gates** check passed. Main-branch protection prevents force pushes/deletion and requires the check before merging. Vercel then builds that tested source with the pinned Node major. A release is operational only after the public readiness endpoint and the external account/collection/image flows succeed; a READY build or passing liveness endpoint alone is insufficient.

For a bad code release, use Vercel's rollback to the previous verified deployment. Do not run the test-refresh tool against production. Database disaster recovery requires a separately reviewed administrative restore to a fresh database from a verified production snapshot, the matching vault recovery material, revocation of sessions, replay of deletion/consent changes and complete readiness/user-flow checks before cutover.

The scheduled backup job uses a restricted `production-backups` GitHub environment and only the dedicated reader URL, backup-store token and public key fingerprint. The private recovery key and production vault key are not job secrets. Enable it only after the protected environment is configured and its manual end-to-end run succeeds.
