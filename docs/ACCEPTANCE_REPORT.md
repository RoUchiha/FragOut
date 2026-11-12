# FragOut acceptance report

**12 November 2026** · FragOut 0.2.0 mobile and 0.1.0 server · Acceptance changes based on `bab58a9`

## Scope

I exercised the mobile app first, then the desktop companion and shared API. The runs used Chromium at 320–390 px for mobile and 1366 px and 390 px for the desktop companion, a Windows production Next.js build, an Android 16 emulator, local Qwen3-VL 2B, a disposable SQLite database, and synthetic accounts in the managed Supabase project. Photo tests used an illustrated outfit and a public bottle packshot. The regular local wardrobe and cloud accounts were outside the test fixtures.

## Defects found and fixed

| Reproduction | Observed before the fix | Correction |
| --- | --- | --- |
| Open Account and submit an incorrect password | The form closed and the app dropped to its server connection screen | The form stays open on a sign-in rejection. The app preserves the current origin-bound session for retry and displays the error in the form. |
| Start mobile while the account-state API returns 503 | The app treated the outage as an expired login and attempted to start a demo | Only HTTP 401 triggers demo authentication. Other startup errors display a retry path. |
| Enter a loopback HTTP URL in the Android release app | Android blocked cleartext transport after the app accepted the URL. The screen displayed the raw native fetch error. | The connection screen explains the HTTPS requirement before connecting. Other native network failures display recovery guidance. Android development builds still accept local HTTP. |
| Press Connect while the native keyboard is open | The first tap dismissed the keyboard. A second tap was required to submit. | The connection screen forwards the first tap to its button. |
| Edit the model's Garments or Colors and type a comma followed by another item | The controlled input removed commas and spaces as they were typed | The fields preserve text during editing and parse the item lists for the recommendation request. Edits reset confirmation. |
| Inspect the active mobile tab with the browser accessibility tree | The tab changed visually while the selected state was absent from the web tab element | The tab exposes its selected state to the browser and native accessibility APIs. |
| Open a desktop shortcut with Enter, then close its recommendations with Escape | Focus went to the document after the shortcut was temporarily disabled while loading | The results dialog remembers the control that opened it before the request starts. |
| Run Expo Doctor against SDK 58 | Nine installed package versions were behind the recommended patches | Aligned the packages to SDK 58 and registered the updated status-bar plugin in the dynamic Expo config. The online dependency check and all 20 Expo Doctor checks passed. |

## User journeys

| Journey | Observed behavior |
| --- | --- |
| Mobile accounts | Demo starts with fictional bottles. Registration starts with an empty collection. Sign out revokes the bearer session, sign in restores the same collection, and typed confirmation deletes the disposable account. Wrong credentials and a simulated 503 have separate recovery paths. |
| Collection | Added Dior Sauvage EDT and EDP as separate variants, added a second EDP bottle as a distinct item, edited a private memo, filtered Wishlist, favorited a bottle, and removed it. Searched by fragrance name. |
| Find a scent | Exactly two tabs. Suggestions appear below search. `tired clean work` applied all three cues. A logged wear preserved Work, mood, and vibe. Fragrance-free conditions suppressed recommendations. |
| Layering | Evidence-only returned its empty state. Opting into experiments produced labeled pairs of two owned bottles. A liked pair appeared on Home under Liked combos and disappeared after unlike. |
| Settings and theme | Preferences and manually entered conditions persisted. Tested hemisphere and local-time styling as well as the theme and contrast rules in the unit suite. |
| Outfit text and photo | Real Qwen interpreted text and the gallery fixture. The user could edit the interpretation, confirm it, and request fragrances and experimental pairs. Default analysis retained zero photos. Opt-in archiving made a selected photo visible in the owner's Saved looks, and disabling archiving cleared the archive. |
| Bottle scan | Qwen returned three candidates for a Sauvage EDP packshot, including the exact edition. The app held the collection unchanged while reviewing candidates and required confirmation before saving. |
| Provider connections | Qwen passed the connection test. OpenAI and Anthropic setup, hidden keys, selection, destination disclosure, error handling, and disconnect were exercised with fixture credentials. Both returned to Qwen after disconnect. |
| FragDex | Opened the exact edition, enlarged the same thumbnail, expanded citations, and followed Aventus alternatives and the reverse Armaf dupe link. Clicking a wear estimate and a retailer/community link opened popups at their matching URLs. The external pages used local responses for the popup checks. A real administrator uploaded, hid, and restored a shared photo in the test catalog. |
| Desktop companion | Six browser groups covered demo, Gym picks and application guidance, journal entries, pairing modes, Guide, notes/preferences, a future event, custom shortcut ordering and hiding, account and inventory workflows, export, the account-deletion link, privacy, and narrow navigation. |
| Android development build | The app ran on Android 16 with an actual local API connection. A wear log and its session survived a force-stop. After removing the connection temporarily, Retry recovered the same journal. Typed outfit matching, the native share sheet and its temporary-file cleanup, and a Google sample banner passed. The camera denial message was actionable. After granting permission, the emulator's front camera produced a preview that could be removed. Microphone denial left the text field usable. These journeys used the SDK 58 development build before the patch alignment. |
| Managed storage | The application wrote to live Supabase over TLS. Collection data, session, and encrypted archived photo survived restarting the API. Anonymous and other-account photo reads were denied. Account deletion revoked the session and removed its photo. All 17 private tables had row-level security and were inaccessible to public Data API roles. In a separate run, scheduled cleanup physically removed an expired synthetic photo and its receipt eight seconds after they were marked expired. |

The full browser walkthroughs passed 11 mobile groups and six desktop groups after the dependency update. Across the two browser runs, local Qwen took 13.2–24.4 seconds for the typed outfit, 36.9–52.7 seconds for the gallery requests, and 37.8–57.2 seconds for the Sauvage scan. The slower measurements were recorded during a concurrent Android compile. Timing includes local inference and browser processing on the test PC. Dictation's transcript and edit flow passed with a synthetic browser speech event. The Android run exercised microphone permissions.

## FragDex data and timings

The bundled catalog contains 218 exact editions with corroborated notes. Every thumbnail decoded to a nonblank JPEG with no EXIF, and all 218 files had distinct hashes. All scored rows were between zero and five and linked to a source record. These checks cover file integrity and catalog consistency. The scan results below are individual fixtures.

| Facet | Bundled editions with a score | Bundled editions showing N/A |
| --- | ---: | ---: |
| Overall | 0 | 218 |
| Longevity | 96 estimates | 122 |
| Projection | 15 estimates | 203 |
| Sillage | 83 estimates | 135 |
| Scent | 0 | 218 |
| Versatility | 0 | 218 |
| Value | 0 | 218 |
| Bottle | 0 | 218 |

FragDex displays eight rows even where no supported score exists. The optional Fragella connector can supply live overall scores and some additional estimates. Its exact-edition matching and mapping passed fixtures. Live scores require a server-side developer key. [Fragella API documentation](https://api.fragella.com/docs.html)

| Edition | Save request | Save through image download and decode | Cached profile |
| --- | ---: | ---: | ---: |
| Dior Sauvage EDP, bundled | 18 ms | 39 ms | 11 ms |
| Dior Fahrenheit EDT, first automatic lookup | 15 ms | 951 ms | 11 ms |
| Versace The Dreamer EDT, first automatic lookup | 14 ms | 778 ms | 11 ms |
| Synthetic label outside the public index | 14 ms | 23 ms to an unmatched profile | 10 ms |

Both automatic lookups delivered a 900 × 900 JPEG from FragOut. The standalone scraper staged one usable Fahrenheit image. In the final full browser run, saving Sauvage EDP and EDT to the returned FragDex profile took 95 and 103 ms. An arbitrary private label saved successfully without a fabricated catalog entry. The automatic lookup measurements came from two uncached requests on one host. Retailer coverage and response time can vary.

## Release and service coverage

- iOS source and Expo configuration generated the application identifier and the expected camera, photo-library, microphone and speech prompts. The configuration disables file sharing and arbitrary transport loads. A native iOS simulator or device test and signed IPA require macOS/Xcode or a connected Expo build project and Apple signing credentials. [Expo SDK 58 and its supported platforms](https://docs.expo.dev/versions/v58.0.0/)
- Native AdMob served a Google sample banner. Unit tests verify that a banner with no creative has zero height and is excluded from pointer interaction and accessibility focus. Production ads and the live consent flow require publisher IDs and consent configuration. [Google sample ads](https://developers.google.com/admob/android/test-ads)
- OpenAI and Claude connection tests used fixtures. Live inference needs valid provider keys. The app connects by API key. OAuth and chat-subscription login are still unimplemented.
- Weather conditions are manual. The reviewed layering registry has no live approved pairs, so evidence-only can correctly return an empty result. The source-backed ranking and tier rules have positive unit fixtures. Actual preference for a scent or pair remains subjective.
- The cloud database is live. A public HTTPS app server, real privacy contact, signed store artifacts, and device checks on iOS are still needed for public mobile distribution. [Cloud setup](CLOUD.md) · [Store builds](../mobile/README.md#store-builds)

## Verification record

| Check | Result |
| --- | --- |
| Backend `npm.cmd run verify` | TypeScript passed, 181 tests passed, production build passed. The publication check inspected 10 build traces and 248 public assets. |
| Mobile typecheck, lint, web export and native export | All passed. The native export produced separate Android and iOS Hermes bundles. |
| Expo SDK compatibility | Online `expo install --check` passed. Expo Doctor passed 20 of 20 checks. |
| Production dependency audits | npm reported zero known vulnerabilities for the backend and mobile production dependency sets at the time of the run. |
| Production API checks | 20 companion, seven mood and vibe, and 18 mobile checks passed. The mobile suite included authenticated real Qwen photo analysis. |
| Browser acceptance | 11 mobile groups and six desktop groups passed against the upgraded build. |
| Android package verification | Built the optimized preview APK and an unsigned App Bundle from the corrected SDK 58 source. APK signature, ZIP alignment and Google `bundletool` validation passed. The packages include `arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64`. The check verified 16 KB alignment for 50 native 64-bit libraries in each package. |
| Final Android device smoke | Installed and launched the rebuilt APK on Android 16. With the keyboard still open, one press of Connect produced the expected HTTPS guidance. The final manifest targets Android API 36 and declares API 24 as its minimum. |
| Managed Postgres | The final API build passed the live restart, persistence, photo access, and deletion walkthrough. The scheduled expiry and database grants were checked separately. Supabase's Security Advisor returned zero findings. |

The Android preview uses a test signature. The store bundle is unsigned and needs the owner's Play signing setup. The Windows native build used short Gradle cache and CMake output paths to avoid a Ninja filename-length failure.

| Android artifact | SHA-256 |
| --- | --- |
| `FragOut-Android-0.2.0-Preview.apk` | `5e492b836b96c79154083360784d991b18b58956d6ae8f3c849d42c4acd3572e` |
| `FragOut-Android-0.2.0-Unsigned.aab` | `782095a5e4b16299e1069371126d51d82fc7405db5c2cb398f0fc059d62c78c5` |

## Repeat the checks

Run the API tests against a disposable server. They create and delete test accounts. `FRAGOUT_TEST_URL` selects that server. `FRAGOUT_FIXTURE_PATH` enables the real Qwen image check in the mobile suite.

```powershell
npm.cmd run verify
npm.cmd run typecheck --prefix mobile
npm.cmd run lint --prefix mobile
npm.cmd run export:web --prefix mobile
npm.cmd run export:native --prefix mobile
node tests/http.mjs
node tests/http-intent.mjs
node tests/http-mobile.mjs
```

Run `npx.cmd expo install --check` and `npx.cmd expo-doctor@latest` from `mobile` for the online SDK checks. For the photo suite, convert the checked-in `tests/fixtures/outfit.svg` to PNG or point `FRAGOUT_FIXTURE_PATH` at the workspace's synthetic outfit PNG.

The Windows acceptance workspace keeps the browser, Android, catalog and cloud test logs under `work/fragout-acceptance`. It also holds the browser and emulator screenshots. Tests use disposable images and accounts.
