# FragOut security assessment

Verified locally on 6 November 2026. The assessment found and corrected concrete privacy failures. No unresolved, reproduced cross-account disclosure remains in the tested application paths. This is a scoped source review and adversarial local assessment, not a guarantee against every attack or a production certification.

## Scope and method

The user requested rigorous verification of provider authentication, user data and photo deletion. Tests covered the Next.js production API, Expo mobile source/browser export, SQLite storage, provider adapters, build manifests and local file permissions. Independent read-only reviewers checked credential/session and image/retention paths, reproduced additional failures, then replayed them after correction.

Attacks ran against a separate loopback-only production server, disposable database, local structured-model stub, synthetic account identities, fake key canaries and generated images. No personal photos, actual provider keys, paid inference or external targets were used. A separate real local Qwen call used an original illustrated shirt/trousers fixture. No hosted site or app-store release was made.

**The app currently connects OpenAI/Claude through API keys, not OAuth.** There is no provider OAuth callback, authorization-code flow or subscription-token login to assess. FragOut's own session tokens and encrypted provider keys were tested directly. An eventual OAuth implementation needs its own review, including PKCE, state, callback allowlists and refresh-token handling.

## Corrected failures

P1 means high impact; P2 means medium impact in this local app's threat model. Related failures are grouped below. Hardening controls that were not demonstrated as a disclosure are listed separately.

| Finding | Before | Correction and evidence |
| --- | --- | --- |
| P1: delayed login could cross server origins | A login response from server A could install A's token after switching to B. Competing sign-ins and queued storage cleanup also raced. | Generation-bound requests, aborts, exact origin envelopes and serialized SecureStore writes. Delayed/competing login, redirect and old-cleanup regressions pass. Browser preview is fixed to its document origin. |
| P2: logout could leave usable local state | Local invalidation waited for remote work; failed photo cleanup could prevent stored credential removal. | Immediate token/UI invalidation. Remote revocation, photo cleanup and credential deletion proceed independently. Offline/failing-cleanup regressions pass. |
| P2: delayed native export crossed accounts | Account A's response could be written/shared after switching to B during a native availability check. | Session checks after every awaited step, separate temporary filenames, cleanup in `finally`. Reproductions now produce zero stale writes/shares. |
| P2: app-owned image copies outlived disposal | Original browser Blob URLs survived removal; interrupted native captures could leave cache files, including iOS root-cache image formats. | Revoke original/converted URLs, clear byte references, sweep only recognized app-owned paths and formats at startup/session changes. Real Blob-read and synthetic native-cache regressions pass; gallery originals are untouched. |
| P2: old upload survived archive off/on | Disabling then re-enabling archiving before inference finished allowed the old photo to be staged. | Persistent per-user consent epoch captured before asynchronous processing; every explicit opt-out increments it transactionally. Original reproduction and real HTTP delay/off/on attack now retain zero photos. |
| P2: unsaved clothing copies outlived expiry | A recommendation snapshot retained a copied profile after its source analysis expired or archiving was disabled. | Strip copied outfit metadata when the source expires and on opt-out, preserving the wear context. Regression and HTTP/database assertions pass. |
| P2: permissive authentication/request handling | Malformed bearer headers could fall back to a cookie; cookie mutations allowed missing Origin; JSON type checks accepted an invalid media type; hostile hosts were not restricted. | Reject malformed bearer headers, missing/foreign/null Origin on cookie mutations, cross-site private reads, unknown Host and invalid media types. Native bearer isolation and raw Host-header attacks pass. |
| P2: shared login throttle interference | Malformed unauthenticated logins consumed a global bucket used by unrelated valid accounts. | Validate before counting; sign-in uses an email-scoped bucket separate from anonymous account creation. Repeated malformed login regression preserves a valid unrelated sign-in. |
| P2: HTTPS cookie protection depended on configuration | HTTPS could issue a non-Secure cookie and accept a legacy name susceptible to sibling-domain cookie injection. | Automatic Secure/HttpOnly/SameSite cookies and the `__Host-` prefix on HTTPS. Legacy names are ignored there; isolated route tests verify cookie attributes and selection. |
| P2: deployment trace included the private database | A shared request-policy module caused the middleware's dependency manifest to list the private SQLite file even though HTTP routes did not serve it. | Separate runtime private-path code from the proxy graph, exclude private artifacts, and fail builds if traces/public assets contain private files. Original build check failed; final check passes across 8 traces and 30 public assets. |
| P2: inherited local data permissions were too broad | The workspace's inherited ACL granted additional local identities access to data/key files. | Dedicated data directory, no unrelated files/leaf links, user/System/Administrators-only Windows ACLs; 700/600 on POSIX. Actual Windows ACL inspection and disposable-directory regression pass. |

Additional hardening: nonce-based script CSP, no framing, same-origin resource policy, no-referrer, no-store private responses, bounded body reads, fixed provider destinations, redirect refusal, image magic/MIME/dimension checks, EXIF stripping, strict structured model outputs and no paid fallback. Model-injected product IDs are rejected; wardrobe notes and provider keys do not enter inference prompts. The model has no arbitrary file/network tools.

## Image and description lifecycle

| Data | Default | When archiving is explicitly enabled |
| --- | --- | --- |
| Original photo-library image | Kept in the user's library. The app does not delete it. | Same. |
| App-owned original/converted selfie files and preview URLs | Removed/revoked on submission, removal or screen exit. Known orphan copies are swept on startup/session changes. Image bytes remain briefly in memory to complete the explicitly requested analysis. | Same local cleanup. |
| Backend selfie/photo bytes | Resized/metadata-stripped in memory and sent only to the selected provider; no image row or public file is created. | Sanitized photo may be staged as authenticated AES-GCM ciphertext for up to 15 minutes. Only an explicit reviewed **Archive look** attaches it to a fragrance/pair. |
| Bottle scan image | No backend retention. Local scan copy is removed after label reading, before the user confirms accuracy and adds the fragrance. | Bottle images cannot be archived. |
| Unsaved outfit description | Owner-only, 15-minute lifetime. No outfit copy in default recommendation records. | Same source lifetime; temporary recommendation copies expire with it. |
| Explicit saved outfit/fragrance combination | No saved look while archive preference is off. | Private saved metadata plus optional encrypted photo; persists until look deletion, account deletion, demo expiry or archive opt-out. |
| JSON account export | Owner-only account/journal/current-description data; no provider keys, session tokens, passwords or photo bytes. | Includes saved-look metadata, without photo bytes. |

Expired pending photos/descriptions are inaccessible to normal reads and removed on access/startup and by a one-minute sweep while the server is running. A stopped server performs cleanup when restarted. Archive opt-out deletes saved looks and photos atomically, invalidates prior retention consent and strips recommendation clothing copies. It does not delete the user's gallery or independently saved exports.

Saved photos are never placed under `public`, object-storage buckets or token-bearing URLs. A photo request needs an active owner session and a matching saved look. Knowing another account's exact look/photo/analysis/recommendation IDs did not grant access. Image encryption uses an installation-derived, domain-separated key and owner/purpose-bound authenticated data; moving or tampering with ciphertext fails.

## Credentials and provider boundary

Passwords use salted scrypt; session tokens are random, hashed in SQLite, revocable and expire after seven days. Native storage uses an exact-origin envelope and device-only, unlocked SecureStore access. Browser-preview bearer tokens remain in memory; desktop cookies are HttpOnly. API-key destinations are fixed HTTPS provider endpoints and cannot be changed by request input. User keys are encrypted with authenticated owner/provider binding, absent from status/export/build assets, and never silently borrowed from another account.

OpenAI requests set `store:false`, and Claude requests do not opt into prompt caching. These settings do not delete provider-controlled safety logs or guarantee zero retention. OpenAI documents separate abuse-monitoring retention and additional image exceptions; account-specific data controls may apply. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Anthropic likewise documents API retention and exceptions in its [commercial data retention policy](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data). FragOut cannot remotely erase provider infrastructure. These policies were checked during this assessment; cloud adapters used fixtures, not actual keys.

Local Qwen requests use `keep_alive:0`; a real synthetic-image call succeeded and Ollama reported zero loaded model contexts afterwards. This reduces live context retention; it is not a forensic memory-erasure guarantee. The running Ollama and app listeners were confirmed at 127.0.0.1 only.

## Verification evidence

| Check | Result |
| --- | --- |
| Backend/unit regression suite | 87 passed, zero failed/skipped. Includes model/engine constraints and security/storage/session regressions. |
| Isolated production HTTP security suite | 173 assertions across 12 groups passed. |
| Existing companion HTTP suite | 20/20 passed. |
| Existing mobile/API suite against local stub | 17/17 passed; no paid inference. |
| Independent fix replays | Off/on photo race: zero retained photos. Expired snapshot: clothing removed. Export race: zero stale writes/shares. |
| Backend typecheck/production build | Passed; 8 trace manifests and 30 public assets clear of private artifacts. |
| Mobile strict typecheck/lint | Passed. |
| Expo web plus Android/iOS Hermes exports | Passed. Code bundles are not signed phone installers. |
| Dependency audits | Root and mobile audits reported zero known vulnerabilities at the time checked. |
| SDK dependency compatibility | Installed Expo 58 local compatibility map passed; remote compatibility endpoint was unavailable in that check. |
| Browser, 390 × 844 | Default off; synthetic photo → removed preview/review → matches; opt-in → reviewed save → private archived photo; opt-out confirmation explains deletion. No captured console warnings/errors on mobile/desktop. Actual purge is also tested through HTTP/database assertions. |
| Real local image pipeline | Original illustrated fixture succeeded in about 27.5 seconds; no personal photo. |
| Private filesystem and listeners | Actual data ACL restricted; default services loopback-only. A process running as the authorized service user can still open its files. |

The source package excludes databases, installation keys, local environment files, dependency installations, model weights/runtime, temporary test data and personal uploads. It includes source plus generated mobile code/assets and this report. The archive is inspected after packaging.

To repeat the disposable production attack lab after building:

```powershell
node scripts/security-lab.mjs --test
```

The lab creates synthetic data under the workspace's `work/security-lab-*` directory and never opens the main database. The synthetic model stub records test-only inputs in memory for canary assertions. Test scripts clean up their synthetic accounts; a stopped lab retains no running model stub. Main app logging does not record request bodies, photos or keys.

## Boundaries before a public/mobile release

- Physical iOS/Android camera interruption, OS decoded-image caches, crash/power-loss deletion, SecureStore failure modes and sharing behavior have not been tested on a phone. An OS share sheet already opened by the user cannot be retracted by a later account change. User-saved downloads, screenshots and gallery originals remain user-controlled.
- There is no provider OAuth implementation or live paid-provider verification. Cloud retention, device speech services and provider account controls are outside FragOut's deletion boundary.
- No public hosting/proxy/CDN/storage configuration was deployed or scanned. Production must use HTTPS, an explicit exact `FRAGOUT_PUBLIC_ORIGIN`, trusted forwarded headers, persistent private storage, private backups and a dedicated service identity. Development LAN HTTP requires explicit development-only configuration on both client and server.
- An administrator, compromised service account, debugger or malicious process with that account's filesystem access can read ordinary account metadata and the installation key. Metadata is not full-database encrypted. Leaf links and published paths are rejected; custom storage must not use ancestor junctions/aliases or shared/public mounts. A public deployment needs its own filesystem and backup review.
- SQLite secure deletion and encryption do not prove erasure from prior backups, WAL snapshots, OS memory, disks or forensic recovery. Backups need a separate retention/deletion policy.
- These tests do not establish resistance to every denial-of-service attack or every future dependency flaw. Managed identity/recovery, distributed abuse controls, operational monitoring and release-device acceptance remain production work.

Screenshots of the verified privacy controls and a synthetic private saved look are provided alongside the app source. The normal local preview remains available at [localhost:3000/mobile](http://localhost:3000/mobile).
