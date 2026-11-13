# FragOut web and iOS acceptance

## Web

The optimized Next.js build and Expo web export passed. The build check inspected 10 deployment traces and 248 public assets for private databases, keys, environment files, and source maps. The browser compatibility pass had 182 automated tests and 45 production HTTP checks. The grounding follow-up passed 187 automated tests, all 45 HTTP checks, and 173 privacy and session assertions.

| Browser engine | Mobile layout | Desktop companion |
| --- | ---: | ---: |
| Chromium 149 | 11/11 | 6/6 |
| Firefox 159 | 11/11 | 6/6 |
| WebKit 27.2 | 11/11 | 6/6 |

The 51 browser runs exercised these user paths.

- Create an account, retry a rejected sign-in, recover from an unavailable server, sign out, export JSON, and permanently delete the account.
- Add and edit exact fragrance variants, filter the collection, mark favorites, and view FragDex notes, ratings, dupes, bottle thumbnails, enlarged photos, and rating and retailer popouts.
- Search by mood, vibe, and occasion, log a wear, enable experimental layering, and manage liked combos from Home. Venue and scent preferences affected the results.
- Describe an outfit, use browser dictation with a synthetic transcript, upload a gallery photo, review the inferred clothing, and match a fragrance. The default photo was discarded. Enabling the archive allowed a chosen look to keep its private photo, and turning the archive off removed it.
- Scan a bottle and confirm its identity before saving. A regular account lacked the shared photo editor. An admin account could upload, hide, and restore the exact edition photo.
- Select Qwen and manage OpenAI and Claude connections with synthetic keys. Browser tests made zero paid inference calls.
- Exercise the time and hemisphere palette, responsive navigation, shortcut editing, and keyboard focus in the desktop companion.

The Chromium runs used the installed Qwen vision model. Firefox and WebKit used deterministic model responses to exercise the same upload and privacy paths. The WebKit tests ran against Playwright's WebKit engine on Windows. Firefox upload tests used the updated Playwright build with the file chooser interception fix. [Playwright Firefox file chooser change](https://github.com/microsoft/playwright/pull/44043)

| User action | Observed duration in the final Chromium run |
| --- | ---: |
| Add the bundled Dior Sauvage EDP and open its FragDex profile | 155 ms |
| Add and open an alternate bundled edition | 116 ms |
| Analyze the typed outfit with local Qwen | 15.1 s |
| Analyze the synthetic gallery photo with archiving off | 37.8 s |
| Analyze the synthetic gallery photo with archiving on | 38.5 s |
| Analyze and review the bottle scan with local Qwen | 42.3 s |

These timings describe one local run. The FragDex measurements are for bundled profiles. Internet enrichment and other models have separate latencies.

### Web changes

- The browser picker handles selection and cancellation once and removes its temporary input. The source photo blob and processed preview still follow the existing deletion rules.
- The account export keeps its temporary Blob URL available briefly for the browser to read the download and then revokes it.
- Both existing loopback previews served the rebuilt mobile page and bundle after refresh. Local Qwen was available on both.

## Model and source grounding

The installed free model is Qwen3-VL 2B Instruct through loopback Ollama. The model interprets photos. Typed and dictated outfits use the user's text, search matches catalog and collection terms, and the rules engine produces recommendations. [Ollama model](https://ollama.com/library/qwen3-vl%3A2b-instruct)

| Controlled cases | Observed before the fix | Verified with the grounding checks |
| --- | --- | --- |
| Four typed descriptions | Qwen added unsupported style labels to simple descriptions. | The app parses explicit clothing and colors, drops denied items from the matching attributes, and abstains when there are no clothing details. |
| Three outfit photos | The non-clothing photo returned a bottle as a garment despite an abstention. | A clear outfit returned its shirt, trousers, shoes and colors for review. The blank image and the bottle image returned no outfit. |
| Five bottle images | The model gave names for an unlabeled bottle and a blank image. It called a Sauvage EDT photo EDP. | The readable Sauvage EDP gave one candidate, and the user still had to confirm it. The EDT photo with no readable concentration, blank image, unlabeled bottle and a synthetic out-of-catalog label went to manual entry in these trials. |

The bottle reader uses bundled local OCR. Product identity needs independently read brand and fragrance text. Concentration comes from the printed label when readable. Clear exact catalog matches can be returned directly from OCR. The server discards the image data after processing. The Chromium bottle confirmation flow took 1.6 seconds on the clear EDP fixture. Outfit photos still use Qwen and require user review because visible colors and garments can be misread.

The catalog has 218 exact profiles, 1,089 note claims, 196 wear estimates, and 241 dupe relationships. Automated checks validate source attribution and exact editions. Live spot checks confirmed Dior's bergamot and vanilla notes for Sauvage EDP and Creed's bergamot, pineapple, and birch for Aventus. Dossier identifies Musky Oakmoss as inspired by Aventus. [Dior Sauvage EDP](https://www.dior.com/en_us/beauty/products/sauvage-eau-de-parfum-Y0785220.html), [Creed Aventus](https://creedboutique.com/products/aventus), [Dossier Musky Oakmoss](https://dossier.co/products/musky-oakmoss)

The three archived source snapshots matched the documented SHA-256 digests. Recompiling with them regenerated both published catalog JSON files byte for byte. The 196 ratings in the bundled snapshot are labeled wear estimates. Unsupported facets show N/A. Live ratings from the optional Fragella connection require its configured API key. [Catalog sources and rating methodology](../catalog/README.md)

The Aventus dupe spot check replaced an unavailable comparison link and verified separate firsthand comparisons for the Armaf EDT and EDP. These sources support a community comparison. Wearer reports differ on how close the opening and drydown are. [EDT comparison](https://www.reddit.com/r/fragranceclones/comments/qewdd8/creed_aventus_genuine_vs_clone_comparison_cdnim/), [EDP comparison](https://www.reddit.com/r/fragrance/comments/tr2oi4/armaf_cdnim_review_of_different_versions_2022/)

FragOut now uses the exact catalog profile for recommendations when a bottle has no personal notes. An unsupported projection stays unknown and the bottle is excluded from settings that require a known projection limit. The first published layering entry covers Jo Malone Wood Sage & Sea Salt Cologne with Peony & Blush Suede Cologne. The browser and API checks verified the exact pair and its citation. Other combinations without approved direct evidence remain opt-in experiments. [Jo Malone scent layering guide](https://www.jomalone.com/scent-layering)
