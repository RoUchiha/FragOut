# Production isolation, recovery and release quality

The user requested an honest live-status check, a private development/test app with one-way production data refresh, redundant production backups, and professional production engineering practices. They subsequently chose to keep the test database local. Keep the existing Next.js/Expo architecture and account/privacy behavior.

## Verified starting state

- Source: `189e412`; 249 automated tests pass and the working tree was clean. Work continues on `build/production-isolation`.
- Public Vercel HTML responds, but `/api/health` returns 500. Runtime logs identify an unresolved external OCR-language module. The deployed runtime is Node 26 despite the intended Node 24 setting.
- Only `FRAGOUT_PUBLIC_ORIGIN` exists in the production Vercel environment. No production database URL or vault key has been uploaded. The earlier conditional consent does not authorize claiming zero exposure risk or silently uploading these values.
- Managed Supabase `FragOut` is healthy, private, and empty (zero users/bottles); its security advisors return no findings. Free-plan projects lack the paid managed-backup coverage. The two-project free limit prevents a new Supabase project.
- Reserved Vercel `fragout-test` is protected on every URL and pinned to Node 24. No test database or production credentials were connected. Neon requires separate human terms acceptance; the user chose local test storage instead.

## Implementation

1. **Repair and verify the deployment artifact.** Remove eager OCR-language-module loading; resolve the packaged language asset safely only when OCR runs, keep OCR failure isolated, pin Node 24, and verify the actual packaged API/OCR dependency paths. Test liveness separately from database readiness. Add safe request correlation and error handling without recording private inputs.
2. **Separate environments and enforce refresh direction.** Add explicit runtime environment identity. Start a private local test instance with separate SQLite storage/key/address. A separate operator tool reads a consistent production snapshot using read-only access and imports an allowlisted sanitized copy only into a target marked `staging`. Never restore into production through that path. Exclude production sessions, passwords, provider credentials, photos, private notes, outfit descriptions and temporary records. Prevent overlapping refreshes and reject reversed/mislabeled destinations before writing.
3. **Back up and prove recovery.** Capture full app-table snapshots consistently, including encrypted records and the vault material needed to recover them. Encrypt snapshots with authenticated envelope encryption and a separate recovery key. Keep protected local backups plus a separately protected off-site copy where available. Record retention/checksums and restore a backup into an isolated database to verify counts, blobs and integrity. Schedule only the tested backup job; never put secrets or backup payloads in public source, build assets or CI artifacts.
4. **Release and operational controls.** Add root/mobile checks, the publication audit, packaged dependency smoke checks and synthetic API tests to a least-privilege CI workflow. Add dependency update/security policies, a deployment check and rollback/recovery runbooks. Improve the user-facing failure message and test-environment labeling without expanding the compact navigation.
5. **Verify the full result.** Run focused red/green tests, the complete suite, TypeScript, mobile lint/types, production build, packaged artifact checks, synthetic HTTP/privacy flows, backup restore and one-way-refresh attack cases. Refresh the private runtime, verify GitHub CI, and report exact live/blocked status. A fully live public API requires concrete approval to configure production secrets, plus successful external end-to-end checks; signed iOS publishing remains separate.

## Decision boundaries

Use free infrastructure while the optional budget answer is pending. Do not replace or repurpose the user's other Supabase project. Do not accept third-party legal terms for them. Do not transfer real production secrets to a hosting provider under the impossible-to-expose condition. Finish all independent implementation/testing first; request any necessary final approval against concrete settings and evidence.

Operational resilience, recovery objectives, live AI capacity, identity recovery/email delivery, store signing and load limits must be reported as measured facts or remaining requirements. A passing local build is not evidence of a functioning public deployment, high availability, guaranteed security, or enterprise certification.
