# Production readiness — 18 November 2026

This is an engineering status report, not a claim of enterprise certification or guaranteed security.

## Initial public status

The latest source had deployed successfully to Vercel, but the app was not fully operational: `/api/health` returned HTTP 500. Runtime logs identified an unresolved hashed external OCR-language package, and the function ran on Node 26 rather than the intended Node 24. Only the public-origin variable existed in production; the database URL and vault key had not been authorized for upload under the earlier impossible-to-expose condition.

The existing managed database was healthy, its security advisors were clean, and its user/collection tables were empty. The private Wi-Fi preview was not running at the initial check.

## Changes and verified results

| Area | Implemented / verified |
| --- | --- |
| Deployable API | Node 24 pinned; canonical Webpack packaging; OCR worker/language loading deferred until needed; local language asset retained in the API trace. Isolated artifact loads without the checkout's dependencies. |
| Publication boundary | Nested-route exclusions plus a portable private-runtime trace filter. The independent audit still checks traces and public assets and blocks private files or source maps. A real private-database trace was caught and removed before publication. |
| Environment isolation | Explicit production/staging/development identity; production refuses SQLite; staging requires an explicit database path. Database marker mismatch prevents access. |
| Private test app | Separate local SQLite database/key and HTTPS port 3444, private subnet/exact-host checks, credential-stripped process, TEST label and no-index response headers. |
| Data refresh | Atomic, one-way production-to-local-staging import. Production destinations, wrong source identity and unrecognized snapshot fields are rejected. Copied identities are anonymized; live credentials, images, personal notes and outfit data are omitted. |
| Backups | Authenticated envelope encryption, separate recovery key/escrow, schema-coverage and size limits, full restore verification with binary fields and foreign keys, private off-site checksum read-back and anonymous-access denial. |
| Initial recovery evidence | The actual empty production snapshot was backed up locally and off-site, downloaded with matching SHA-256, and decrypted/restored successfully. Synthetic nonempty backups also exercise credentials, archived binary records, tampering and owner/FK integrity. |
| Operations | Separate liveness/readiness, request IDs, redacted structured access logs, retry headers for rate/storage failures and clearer user-facing error copy. |
| Dependencies | Root dependency audit and mobile production audit returned zero vulnerabilities after a compatible Zod security override for the new backup SDK. |
| Release controls | Pinned, read-only GitHub quality and backup workflows; Dependabot and CODEOWNERS; release/recovery/security procedures. Remote CI and branch-protection activation are recorded below after verification. |

Local verification before the final review: 264 automated tests passed, mobile lint/types and root TypeScript passed, web/Android/iOS bundles exported, production build passed, 30 operational HTTP checks passed, web/mobile journeys passed 20/17 checks, discovery/journal passed 133 assertions, all 218 served thumbnail files passed 699 assertions, and the isolated security lab passed 173 assertions. A schema-drift regression was subsequently added and passed with the focused backup suite. Final totals are recorded after review.

The real local Qwen vision smoke test identified clothing in the synthetic outfit fixture in 28,296 ms, with the expected user-review uncertainty. This is a smoke test rather than a broad accuracy or latency guarantee. It used no personal photo or paid provider. Qwen remains local-only with cloud use disabled.

Browser visual review was not completed. Computer Use stopped because it could not confidently determine the Windows browser URL. No certificate warning was bypassed and no visual pass is claimed. Signed native builds and physical-device acceptance were not performed in this pass; native JavaScript bundle exports are not App Store/TestFlight publication.

## Remaining activation requirements

- Public app storage still requires specific approval to put the existing database URL and vault key in Production-only Vercel server secrets. No security control makes any system impossible to hack.
- Automatic approval review rejected creating/exporting a production reader login into the local operator destination. The role is defined and its no-write privileges verified, but it remains NOLOGIN. Its specific local/GitHub destinations need consent before daily automation is enabled.
- Automatic approval review separately rejected uploading the encrypted production vault escrow to the private Vercel Blob destination without specific consent. The escrow remains local; the private RSA recovery key stays out of hosting/CI.
- The cloud default vision model needs a persistent inference runtime. Typed suggestions and user-connected OpenAI/Claude providers use the existing contracts; free local Qwen on this PC is available to the local test app. A public Vercel function cannot run this PC's loopback Ollama service.
- Managed email verification/recovery, operational ownership/on-call, monitored uptime/capacity objectives, paid high-availability/PITR where required, broader load/accessibility/device acceptance, and store signing/release still require concrete service/business choices. Free preview resources do not provide those guarantees.

No paid plan was selected. The user explicitly chose to keep test storage local. The reserved cloud test project stays authentication-protected without production credentials or a connected database. The source-to-test copy and current backup reflect an empty production database, not a migration of existing local demo accounts.
