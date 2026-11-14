# Mobile and provider verification

Historical build record. See the [web and iOS acceptance report](WEB_IOS_ACCEPTANCE.md) for current browser, simulator, and model results and the [security assessment](SECURITY_REPORT.md) for the session and image-retention checks.

Verified locally on 6 November 2026. This extends the original local-edition verification; the mobile features and provider behavior in this file supersede earlier statements that vision/model integrations were unavailable.

## Automated evidence

- Backend strict typecheck and Next.js production build passed.
- **41 unit tests passed**, including ownership, venue/strength/avoided-note constraints, evidence tiers, full candidate reranking, structured model validation, image validation errors, description expiry, encrypted owner-scoped credentials, tamper rejection and secret-free export.
- **20 companion HTTP checks passed** against the rebuilt production server.
- **18 mobile/provider HTTP checks passed**, including separate bearer/cookie sessions, no cookie token disclosure to a native login, owner-only keys and analyses, provider change rejection before a request, disconnect-to-Qwen behavior, image rejection, real Qwen text/image analysis, owned-only single/pair outputs, evidence and fragrance-free enforcement, scoped export, account deletion and logout.
- Expo strict typecheck and lint passed without errors or warnings. Expo Router manages tab navigation through the screen's URL parameters. Dependency checking against the installed SDK's local compatibility map passed; its online version endpoint was unavailable in the restricted check.
- The final mobile dependency audit reported zero vulnerabilities. Build-tool overrides pin patched `glob` 14.0.2 and `minimatch` 11.0.1, addressing the upstream [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). Exports and lint were rerun with these versions; Expo was kept on SDK 58.
- Expo web export and both iOS/Android Hermes bundle exports passed. A Windows temp-file permission issue was resolved by directing compiler temporary files into the workspace. The backend build needed normal Windows junction creation permissions for Sharp.

## Real model evidence

The free local default is `qwen3-vl:2b-instruct` through portable Ollama 0.40.15, bound to 127.0.0.1:11434 with cloud disabled. It successfully returned a structured profile for a typed white-shirt/trousers/loafers description.

An original illustrated fixture (`tests/fixtures/outfit.svg`, converted to PNG) was passed through the real image adapter and the authenticated API. The model described the white shirt, dark blue trousers and brown shoes. The direct image call took about 30 seconds on this CPU-based host. Style/formality interpretations were imperfect, reinforcing the need for user review. This is a smoke test, not a measured accuracy evaluation. No personal photo was used.

OpenAI and Claude adapters were tested with structured fixtures, fixed destinations, sanitized failures and the absence of paid fallback. Their live inference was not tested: no real paid-provider key was supplied, created or used. Connection testing checks model access, not full image inference quality.

## Browser evidence

The mobile web export was checked at a 390 × 844 viewport:

- Compact Today screen and persistent five-tab navigation.
- Typed outfit → real local Qwen → editable review → occasion and Both → explicitly enabled experimental pairs → single and pair results.
- Wear a result → journal preserves Work and the server's context snapshot.
- Choose the original PNG through the actual gallery picker → browser image conversion → real Qwen photo analysis → reviewable clothing description.
- Qwen readiness, optional OpenAI/Claude fields and no enabled paid connection without a user key.
- Collapsed clothing details, reviewed field edits clearing stale results, and experimental labels in the final preview.

Screenshots are saved beside the source folder. The browser viewport override is reset at handoff.

## Independent review

A read-only review identified destination disclosure gaps, stale outfit matches, pair truncation before style reranking, expired-description exports, an unawaited native export write, failed-logout private UI retention, and capture/unmount races. These were corrected. The focused follow-up confirmed the corrections, including pure local reproductions for expiry and reranking, and found no remaining material issue in that scope.

## Phone release boundary

There is no Android SDK/JDK or Apple signing/Xcode environment configured on this Windows host. No signed installable APK/IPA, EAS build, app-store submission or physical-device test was produced. The supplied native project and Hermes exports are code artifacts, not phone installers. Native camera, microphone, SecureStore and sharing still need device acceptance. Dedicated speech recognition requires a development/production build; Expo Go uses the keyboard microphone fallback. Production phone builds require an HTTPS backend.

The catalog remains manual for real accounts, weather is manual, and reviewed pair evidence is empty. No catalog licensing, photo-accuracy target, fragrance performance or recommendation-quality benchmark is claimed. SQLite is a local persistent-host backend; broader production identity, hosting and operational review remain outstanding.
