# Parfumo-inspired features: verification report

Executed 2026-11-18 against the rebuilt private HTTPS preview at `https://192.168.68.82:3443`. The source branch is `build/fragout`. Tests used synthetic input and disposable accounts; the HTTP suites delete those accounts afterward.

## Results

| Check | Result | What it demonstrates |
| --- | --- | --- |
| `npm test` | 225 passed, 0 failed | Catalog filters, comparison missing-data rules, collection metadata, wear history, date handling, privacy, session transitions, encryption, image lifetime and existing recommendation behavior. |
| `npm run typecheck` | Passed | Next.js route types and strict TypeScript, including API tests. |
| `npm run typecheck --prefix mobile` | Passed | Native/mobile TypeScript contracts. |
| `npm run lint --prefix mobile` | Passed | Expo/React lint with no ignored new errors. |
| Expo web export | Passed | The native app's browser bundle is current. |
| Production Next.js build | Passed | Desktop, mobile preview and API routes compile in production mode. |
| Public-build audit | Passed | 11 server traces and 248 public assets checked; no private database, key files, environment files or source maps in published assets. |
| Gitleaks staged scan | Passed | No leaks found in the staged source, tests or reports. |
| Expo iOS export | Passed | Hermes bundle exported; 5.7 MB. |
| Expo Android export | Passed | Hermes bundle exported; 5.7 MB. |
| HTTPS preview verification | Passed | Trust-profile CA, certificate signature/IP, HTTPS mobile page, Expo script, security headers, API health and anonymous state denial. |
| `tests/http-discovery.mjs` | 133 assertions passed | Search/detail/add/compare/journal/CSV, native bearer sessions, desktop cookies, privacy and rebuilt web entry points. |
| `tests/http.mjs` | 20/20 passed | Existing web account, collection, recommendation, venue, feedback, export and deletion flows. |
| `tests/http-mobile.mjs` | 17/17 passed | Existing bearer isolation, provider-key ownership, free default, typed outfits, private receipts and deletion. No paid inference calls. |

The optional real-image model fixture was not rerun in this batch; no inference/image-processing code changed. The existing unit suites for original-photo cleanup, EXIF removal, encrypted storage, provider consent and account changes passed.

## New interaction and security regressions

- A previous search response cannot reappear after the search changes.
- Repeated taps on a catalog add button produce one request.
- Closing a catalog entry during a pending save cannot reopen its detail sheet; a completed authorized save can still refresh the collection.
- The manual wear form submits the chosen date, two distinct selected bottles and the private note.
- Anonymous catalog, comparison, journal and CSV requests are denied.
- Foreign bottle IDs and foreign wear edits are denied without revealing another owner's records.
- Revoking a session before the journal transaction prevents storing the private note.
- An admin-hidden image stays hidden in both catalog search and detail.
- View preferences preserve archive consent and all other preferences.
- Legacy bottles without shelves remain compatible; invalid shelf counts are rejected.
- Month statistics remain complete when a real wear falls outside the recent 200-activity window.
- Editing a wear after deleting the bottle retains its captured fragrance name.
- Chicago DST changes, month/year boundaries, leap years, invalid dates and future dates are covered.
- Saved pairs, likes and dislikes do not inflate wear totals.
- CSV formula-leading values and quoted notes are escaped. Native temporary exports are deleted after sharing or failure; an account switch prevents sharing a pending earlier export.

## Measured response times

One local HTTPS run on the host PC, using existing catalog data and warm production runtime. Times include request/response parsing. They do not include phone rendering, keyboard interactions or acquiring a previously missing image.

| Action | Time |
| --- | ---: |
| Catalog search | 10.0 ms |
| Open sourced catalog detail | 17.4 ms |
| Create an owned entry | 10.9 ms |
| Create, then fetch FragDex profile and refreshed collection | 22.9 ms |
| Compare saved bottle with the same catalog edition | 6.9 ms |
| Save a dated layered wear | 39.8 ms |
| Ten warm searches: median | 7.1 ms |
| Ten warm searches: slowest / nearest-rank p95 | 7.9 ms |

These small samples characterize this local preview, not a production latency guarantee. Fragrances requiring external photo procurement can take materially longer.

## Reproduce the HTTP checks

Run the app, then set `FRAGOUT_TEST_URL` to its exact configured HTTPS origin and run:

```powershell
node tests/http-discovery.mjs
node tests/http.mjs
node tests/http-mobile.mjs
```

For the private preview certificate, set `NODE_EXTRA_CA_CERTS` to the locally generated test-root PEM. Do not disable TLS verification. `FRAGOUT_TEST_REPORT` optionally writes the discovery suite's non-secret metrics JSON to a chosen local path.

## Installation and remaining limits

The rebuilt preview is available on the same Wi-Fi at `https://192.168.68.82:3443/mobile`; keep the PC's preview process running. iPhone trust-profile setup remains in `outputs/FragOut-iPhone/INSTALL.md` outside the repository.

The iOS and Android artifacts are JavaScript/Hermes exports, not signed IPA/APK packages. This work does not establish App Store approval, native binary compilation or physical-device compatibility. TestFlight signing/submission still requires the owner's Apple Developer credentials. No signed build or TestFlight invitation was created in this batch.

Browser screenshot automation was unavailable in this session, and no physical iPhone/Android tap audit was completed. Component interaction tests, strict checks, production builds and authenticated HTTP flows provide the verification recorded above; visual/device acceptance remains outstanding.

The private preview is local hosting. Vercel's production database/vault configuration and a publicly reachable default-model runtime remain separate deployment requirements; this report does not claim a functional public production deployment.
