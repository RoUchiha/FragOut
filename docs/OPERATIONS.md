# FragOut operations

## Environments

| Environment | Runtime and storage | Access |
| --- | --- | --- |
| Production | `fragout-wardrobe` Vercel project; existing private Supabase `fragout` schema | HTTPS and owner-scoped app sessions. Runtime requires production-only database/vault secrets. |
| Local test | `https://192.168.68.82:3444/mobile`; separate SQLite database under `work/fragout-test/data` | Private Wi-Fi interface/subnet, exact Host validation, HTTPS, app sign-in. Marked TEST. |
| Backup operations | Separate `fragout-backups` project and private Blob store in `iad1` | No app deployment; backup storage credentials are excluded from production and test runtimes. |
| Reserved cloud test | `fragout-test` Vercel project | All deployment URLs protected by Vercel authentication; no database connected. The user chose local test storage. |

The local address applies to this prepared workspace. It requires the PC and phone to share Wi-Fi and the existing iPhone preview CA profile. Its current certificate expires 2026-12-01. Renew through the local preview certificate preparation procedure before expiry and install the renewed trust profile on the phone. Do not bypass certificate warnings or expose this local test port through a public tunnel.

Double-click **Start FragOut Test.cmd** after building to start the test server. `scripts/Start-Test.ps1` reads the local TLS key through Windows DPAPI; the Node process strips inherited database, vault, backup, deployment and provider credentials. It uses its own local encryption key. The free Qwen model runs separately on loopback with cloud use disabled. Stopping the PC stops this local test environment.

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

The initial production snapshot has verified local and private off-site copies. The encrypted vault escrow currently remains local pending specific approval. The reader remains NOLOGIN pending specific approval. The daily GitHub workflow is present but intentionally disabled until its credentials are authorized and a successful manual run is verified. These facts do not establish a running daily backup schedule or a guaranteed recovery point.

## CI, release and rollback

Quality gates install pinned lockfiles on Node 24.16.0, audit dependencies, run root tests/TypeScript and mobile lint/TypeScript, export all platforms, build the server, exclude private runtime paths, audit publication boundaries, load an isolated traced API artifact, and exercise synthetic HTTP/privacy flows. No production credentials are needed for these checks. Actions are pinned by commit; job permissions are read-only.

Production should receive only commits whose **Quality gates** check passed. Main-branch protection prevents force pushes/deletion and requires the check before merging. Vercel then builds that tested source with the pinned Node major. A release is operational only after the public readiness endpoint and the external account/collection/image flows succeed; a READY build or passing liveness endpoint alone is insufficient.

For a bad code release, use Vercel's rollback to the previous verified deployment. Do not run the test-refresh tool against production. Database disaster recovery requires a separately reviewed administrative restore to a fresh database from a verified production snapshot, the matching vault recovery material, revocation of sessions, replay of deletion/consent changes and complete readiness/user-flow checks before cutover.

The scheduled backup job uses a restricted `production-backups` GitHub environment and only the dedicated reader URL, backup-store token and public key fingerprint. The private recovery key and production vault key are not job secrets. Enable it only after the protected environment is configured and its manual end-to-end run succeeds.
