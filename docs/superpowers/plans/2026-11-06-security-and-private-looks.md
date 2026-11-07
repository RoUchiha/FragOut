# Security and private looks implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify each task. Independent read-only security review is required before handoff.

**Goal:** Reproduce and fix data-leak paths, delete app-owned images by default, and make any outfit/photo archive private and explicitly opt-in.

**Architecture:** Keep the local Next.js/SQLite backend and Expo app. Bind native/browser sessions to an exact backend origin and generation; reject obsolete async responses. Never persist default image uploads. Optional saved looks use owner-scoped metadata plus AES-GCM-encrypted images in the private database, never public paths. Pending opted-in images expire after 15 minutes; switching archiving off purges them and saved looks.

**Tech stack:** Node 24, Next 16, SQLite, strict TypeScript, Expo 58, React Native, SecureStore, Sharp.

**Spec:** The user's security request in this chat: adversarial verification of credentials and user images; bottle images removed after accurate confirmation; selfies removed by default after upload unless explicitly archived with outfit/fragrance selections. Existing compact UI and owned-only recommendation rules remain applicable.

## Constraints and boundaries

- Test only this app and loopback test services with disposable synthetic users/images/keys. No actual cloud-provider credentials, personal photos, outside scans, publication or paid inference.
- Current provider connections are BYOK API keys, not OAuth. Do not claim OAuth has been tested or add unsupported subscription-token authentication.
- Private image/credential/database files must never enter public assets, logs, exports by default, or the source archive.
- Gallery originals belong to the user. Delete only app-owned cache copies and browser object URLs.
- Cloud-provider retention cannot be erased by this app; disclose that boundary. Local Qwen requests unload their context after use.
- No claim of complete security or physical-device acceptance from browser/unit tests.

## Review focus

- Delayed login/upload responses after logout, account switch, server switch or archive opt-out must never install credentials, upload an earlier user's photo, or retain a new photo.
- Owner A cannot enumerate/read/mutate owner B's collection, keys, receipts, saved looks or image bytes, even knowing exact IDs.
- Invalid bearer credentials cannot fall back to an unrelated cookie session. Cookie mutations must reject cross-site requests; public HTTPS sessions must be Secure.
- No original or transformed web blob may remain readable after disposal. Startup cleanup must target only known app-owned image cache directories.
- Archive creation must use a server-owned reviewed recommendation snapshot and an explicit enabled preference, not caller-supplied owner/path/image URLs or fabricated metadata.

## Tasks

- [x] **1. Session boundary:** Add failing regression tests for server-switch/login, competing sign-ins, logout before a delayed response, persistence failure, redirect rejection and production HTTP restrictions. Implement generation-bound requests and origin-bound SecureStore envelopes; serialize writes, abort obsolete requests and clear the UI immediately on sign-out.
  Files: `mobile/src/api.ts`, `mobile/src/Settings.tsx`, `tests/mobile-session.test.ts`.
- [x] **2. Photo disposal:** Reproduce original/converted Blob retention. Add tests for revocation on success/failure, safe cache path checks and startup orphan cleanup. Clear default selfie app copies when submitted, including failed requests. Keep bottle confirmation copies only until save/dismissal; sweep known app cache directories at startup/session changes.
  Files: `mobile/src/capture.ts`, `mobile/src/photo-lifetime.ts`, `mobile/src/Outfit.tsx`, `mobile/src/Collection.tsx`, `mobile/App.tsx`, `tests/photo-lifetime.test.ts`.
- [x] **3. Private archive:** Test default-off behavior, consent races, owner isolation, encryption/tampering, pending TTL, selection snapshot validation, opt-out purge and account-delete cascade. Implement reviewed saved looks, protected photo reads and delete routes. No public image URLs. Metadata export is owner-only; photos stay out of the normal JSON export.
  Files: `src/lib/{types,seed,validation,store,private-looks,ai-api}.ts`, API route, mobile saved-look/settings/outfit/results screens, `tests/private-looks.test.ts`.
- [x] **4. HTTP and provider hardening:** Write failing tests for malformed bearer fallback, missing/foreign/null Origin, hostile Host, anonymous throttle interference, HTTPS cookie flags, public data-path misconfiguration, provider redirects and retention options. Apply bounded/private response handling, strict nonce CSP, secure defaults and metadata stripping. Keep a trusted reverse-proxy/HTTPS deployment boundary explicit.
  Files: `src/lib/{security,providers,vault,store}.ts`, `src/proxy.ts`, page/mobile route handlers, `next.config.ts`, route, tests.
- [x] **5. Adversarial lab:** Run repeatable authenticated and unauthenticated attacks against an isolated database and local model stub. Probe IDOR, auth confusion, CSRF/CORS, traversal/static files, image metadata/spoofing/oversize payloads, sensitive caches/errors/logs and archived-photo deletion. Use canaries and report counts, not secret values.
  Files: `tests/security-http.mjs`, `scripts/security-lab.mjs`, `docs/SECURITY_REPORT.md`.
- [x] **6. Verification and handoff:** Run all relevant tests, root production build, mobile lint/typecheck/web/native code exports and dependency audits. Recheck corrected paths independently, verify the browser flows, leave the preview running, refresh the source package without private data, and report confirmed fixes plus untested boundaries.

Each implementation task starts with a failing regression, ends with a passing targeted check, and is committed after verification. The already authorized request is sufficient to apply these reversible local fixes; no additional design approval is needed.
