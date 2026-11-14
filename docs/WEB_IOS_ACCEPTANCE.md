# FragOut web and iOS acceptance

13–14 November 2026

## Web

The optimized Next.js build and Expo web export passed. The build check inspected 10 deployment traces and 248 public assets for private databases, keys, environment files, and source maps. The final code passed 191 automated tests, 45 production HTTP checks, and 173 privacy and session assertions.

| Browser engine | Mobile layout | Desktop companion |
| --- | ---: | ---: |
| Chromium 149 | 12/12 | 6/6 |
| Firefox 159 | 11/11 | 6/6 |
| WebKit 27.2 | 11/11 | 6/6 |

The 52 browser scenarios exercised these user paths.

- Create an account, retry a rejected sign-in, recover from an unavailable server, sign out, export JSON, and permanently delete the account.
- Add and edit exact fragrance variants, filter the collection, mark favorites, and view FragDex notes, ratings, dupes, bottle thumbnails, enlarged photos, and rating and retailer popouts.
- Search by mood, vibe, and occasion, log a wear, enable experimental layering, and manage liked combos from Home. Venue and scent preferences affected the results.
- Search and recommend from an exact catalog profile, verify the reference for a reviewed layering pair, and show no eligible result when a projection limit requires a missing rating. This additional scenario ran in Chromium.
- Describe an outfit, use browser dictation with a synthetic transcript, upload a gallery photo, review the inferred clothing, and match a fragrance. The default photo was discarded. Enabling the archive allowed a chosen look to keep its private photo, and turning the archive off removed it.
- Scan a bottle and confirm its identity before saving. A regular account lacked the shared photo editor. An admin account could upload, hide, and restore the exact edition photo.
- Select Qwen and manage OpenAI and Claude connections with synthetic keys. Browser tests made zero paid inference calls.
- Exercise the time and hemisphere palette, responsive navigation, shortcut editing, and keyboard focus in the desktop companion.

The Chromium runs used the installed Qwen vision model. Firefox and WebKit used deterministic model responses to exercise the same upload and privacy paths. WebKit ran through Playwright on Windows. The WebKit retest scrolled the account-delete control into view and waited for the desktop dialog to acquire focus before pressing Escape. Firefox upload tests used the updated Playwright build with the file chooser interception fix. [Playwright Firefox file chooser change](https://github.com/microsoft/playwright/pull/44043)

| User action | Observed duration in the Chromium walkthrough |
| --- | ---: |
| Add the bundled Dior Sauvage EDP and open its FragDex profile | 85 ms |
| Add and open an alternate bundled edition | 70 ms |
| Review a typed outfit with the default clothing parser | 51 ms |
| Analyze the synthetic gallery photo with archiving off | 24.6 s |
| Analyze the synthetic gallery photo with archiving on | 24.5 s |
| Read the bottle label with local OCR and show the candidate | 1.4 s |

These timings describe one local run. The FragDex measurements are for bundled profiles. Internet enrichment and other models have separate latencies.

### Web changes

- The browser picker handles selection and cancellation once and removes its temporary input. The source photo blob and processed preview still follow the existing deletion rules.
- The account export keeps its temporary Blob URL available briefly for the browser to read the download and then revokes it.
- After changing the shared sheet for the iOS keyboard, 15 regression runs passed across all three engines. They covered account and FragDex, rejected login, outfit archive, bottle scan, and photo administration.
- The label reader now recognizes exact names split across consecutive lines in the same OCR pass. Regression tests also cover multiline and partial concentrations. Chromium retested the Sauvage and Bleu de Chanel EDP scan, confirmation, and FragDex flow. Each returned one candidate. The source-backed recommendation flow passed again on that build.
- Both existing loopback previews served the rebuilt mobile page and bundle after refresh. Local Qwen was available on both.

The privacy checks used synthetic accounts, keys, and images. They verified account isolation, default image disposal, encrypted opt-in storage, invalidation when consent changed during an upload, and absence of credentials in account exports. [Privacy verification](SECURITY_REPORT.md)

## iOS simulator

The release configuration built for arm64 in Xcode 26.6 and passed signature verification and installation on an iPhone 17 simulator with iOS 26.5. The app used Expo SecureStore and a disposable Next.js server backed by SQLite. The model endpoint returned a fixed response for the synthetic gallery image. The separate model checks below used installed Qwen. [Passing iPhone simulator run](https://github.com/RoUchiha/FragOut/actions/runs/43570811595)

The first unsigned build could launch but could not store the session in Keychain. The workflow now embeds the Keychain entitlement during Xcode compilation. The synthetic signing identifier applies only to the simulator workflow. The store configuration and signing credentials are separate.

The iOS keyboard covered the lower part of the account sheet and could leave the wrong field focused. Moving keyboard avoidance to the full sheet kept its input fields and confirmation buttons reachable. Native registration, saving a bottle, and reopening the account after relaunch passed on the rebuilt app.

| Native journey | Observed result |
| --- | --- |
| Account and FragDex | Created a test account, added Dior Sauvage EDP, enlarged the loaded bottle thumbnail, and viewed the cross-checked notes. Relaunch restored the account and its collection. Typing DELETE returned the app to demo, and the database confirmed the registered account was gone. |
| Mood, vibe and wear journal | Searched for tired, clean and work. Logging a wear preserved the occasion and cues across relaunch. |
| Liked combos | Opted into experimental pairs, liked one, opened it from Home and removed it with Unlike. |
| Typed outfit | Reviewed and confirmed the description, then matched a fragrance from the collection. |
| Native gallery and archive | Uploaded and reviewed a photo with default settings and saw the disposal notice. Enabled archiving, uploaded again, archived a chosen match and reopened its private photo from Saved looks. Turning archiving off cleared the saved look and photo. Both database tables had zero rows after the walkthrough. |

All five journeys passed together in 6 minutes 15 seconds. Earlier runs exposed inconsistent simulator timing around system photo selection, the Passwords prompt, and the concentration control. The flow now waits for observable screen changes and verifies the selected concentration before saving. The passing run contains JUnit results and screenshots of the enlarged bottle and privately saved outfit.

Run **iOS acceptance** in GitHub Actions to repeat the simulator walkthrough. It saves Maestro results and screenshots of the synthetic accounts. The workflow starts a private API on the runner with a fresh test database and verifies that no retained photos or saved looks remain after the flows finish. [iOS acceptance workflow](../.github/workflows/ios-acceptance.yml)

### Device and service coverage

- Front and rear camera capture and live microphone dictation still need a physical iPhone. The store IPA and TestFlight need the owner's Apple distribution credentials. Native advertising with production credentials was outside the simulator run. [Expo iOS distribution](https://docs.expo.dev/submit/ios/)
- The browser checks covered rating and retailer popouts, account export, and provider setup. OpenAI and Claude use API keys. The tests exercised synthetic credentials and made zero paid inference calls.

## Model and source grounding

The installed free model is Qwen3-VL 2B Instruct through loopback Ollama. The model interprets photos. Typed and dictated outfits use the user's text, search matches catalog and collection terms, and the rules engine produces recommendations. [Ollama model](https://ollama.com/library/qwen3-vl%3A2b-instruct)

All 13 grounding checks passed on the final run.

| Controlled cases | Observed before the fix | Verified with the grounding checks |
| --- | --- | --- |
| Four typed descriptions | Qwen added unsupported style labels to simple descriptions. | The app parses explicit clothing and colors, drops denied items from the matching attributes, and abstains when there are no clothing details. |
| Three outfit photos | The non-clothing photo returned a bottle as a garment despite an abstention. | A clear outfit returned its shirt, trousers, shoes and colors for review. The blank image and the bottle image returned no outfit. |
| Six bottle images | The model gave names for an unlabeled bottle and a blank image. It called a Sauvage EDT photo EDP. The OCR check missed Bleu de Chanel when the name was stacked over three lines. | The readable Sauvage EDP and Bleu de Chanel EDP each gave one reviewable candidate. The ambiguous EDT photo, blank image and unlabeled bottle went to manual entry. The synthetic out-of-catalog label went to manual entry in one run and returned its exact printed text in another. The printed name still required user confirmation and had no FragDex profile. |

The bottle reader uses bundled local OCR. Product identity needs independently read brand and fragrance text. Concentration comes from the printed label when readable. A partially read concentration stays unknown, including a clipped “de parfum.” Clear exact catalog matches can be returned directly from OCR. Extra packshot spot checks showed the manual-entry fallback can trigger when OCR misses part of decorative lettering. The server discards the image data after processing. Outfit photos still use Qwen and require user review because visible colors and garments can be misread.

The catalog has 218 exact profiles, 1,089 note claims, 196 wear estimates, and 241 dupe relationships. Automated checks validate source attribution and exact editions. Live spot checks confirmed Dior's bergamot and vanilla notes for Sauvage EDP and Creed's bergamot, pineapple, and birch for Aventus. Dossier identifies Musky Oakmoss as inspired by Aventus. [Dior Sauvage EDP](https://www.dior.com/en_us/beauty/products/sauvage-eau-de-parfum-Y0785220.html), [Creed Aventus](https://creedboutique.com/products/aventus), [Dossier Musky Oakmoss](https://dossier.co/products/musky-oakmoss)

The three archived source snapshots matched the documented SHA-256 digests. Recompiling with them regenerated both published catalog JSON files byte for byte. The 196 wear estimates cover longevity in 96 editions, sillage in 83 and projection in 15. The bundled snapshot shows N/A for overall, scent, versatility, value and bottle design. An overall row can still link to a reviewed community page. The optional Fragella integration was exercised with fixtures. Live scores require a configured API key. [Catalog sources and rating methodology](../catalog/README.md)

The Aventus dupe spot check replaced an unavailable comparison link and verified separate firsthand comparisons for the Armaf EDT and EDP. These sources support a community comparison. Wearer reports differ on how close the opening and drydown are. [EDT comparison](https://www.reddit.com/r/fragranceclones/comments/qewdd8/creed_aventus_genuine_vs_clone_comparison_cdnim/), [EDP comparison](https://www.reddit.com/r/fragrance/comments/tr2oi4/armaf_cdnim_review_of_different_versions_2022/)

FragOut now uses the exact catalog profile for recommendations when a bottle has no personal notes. An unsupported projection stays unknown and the bottle is excluded from settings that require a known projection limit. The first published layering entry covers Jo Malone Wood Sage & Sea Salt Cologne with Peony & Blush Suede Cologne. The browser and API checks verified the exact pair and its citation. Other combinations without approved direct evidence remain opt-in experiments. [Jo Malone scent layering guide](https://www.jomalone.com/scent-layering)

### Repeat the grounding checks

With the default model installed in local Ollama, run this from the project directory. The script checks the returned garment and color lists, abstentions, and bottle label candidates. The photo fixtures are an outfit illustration, synthetic negatives, and the bundled Dior and Chanel packshots.

```powershell
node --experimental-strip-types --test scripts/check-qwen-grounding.mjs
```
