# Fragrance catalog

The catalog covers 215 exact releases from 65 houses, including designer bestsellers, niche lines, classics, and affordable fragrances. Every entry has corroborated notes. Ninety-six have at least one sourced wear estimate. Fifteen have exact Fragrantica links, 63 have exact Jomashop listings, and 23 have licensed bottle photography.

The app compares the saved house, release, and concentration with this snapshot on the FragOut server. It keeps EDT, EDP, cologne, parfum, extrait, elixir, and mist separate. Where a label and concentration have documented reformulations, enter the edition year as part of the name to select that profile. Unlisted editions save as a basic entry. The server uses the local snapshot for the initial result, and the optional live rating lookup sends only the public catalog identity. Saved bottles and their profile lookups require the owner's session. Label scans and personal observations follow their private flows.

## Evidence

- The compiler retains note names found in two or more source records for the same edition. It standardizes selected synonyms at the shared level of detail. A note gets a top, heart or base label when two references agree on the stage and every published placement agrees. Otherwise it appears in the general notes list.
- For Green Irish Tweed EDP and Naxos EDP, the profile shows the two wear estimates side by side. MySecretCart compiles typical wear from published information and wearer reports. Gouttes Rares publishes in-house ranges and uses its sillage field for assessed throw. Different wear methods and scales keep their own labels. Oud for Greatness was held out of the performance comparison because the Gouttes listing and the house use different concentration descriptions.
- Official pages corroborate short note names and exact identity. An authorized retailer's exact product listing can also corroborate notes. Parfumo links open the exact edition as a community reference. Publisher ratings, review text, and product photography remain on those sites unless the specific item has reuse permission.

## Five-star ratings

- Every entry has Overall, Longevity, Projection, Sillage, Scent, Versatility, Value and Bottle rows. A facet without supported data shows **N/A**. A linked overall row opens the source even when FragDex has no licensed score for display.
- MySecretCart's published summary of wear reports supplies duration and sillage estimates. The duration midpoint maps to one star per two hours, rounded to a half-star and bounded from one to five. Reported trail strength maps from one for intimate to five for very strong. The separate Gouttes Rares assessment maps its throw band to projection and keeps its longevity result separate.
- The optional Fragella API supplies its weighted overall score on the publisher's five-point scale. FragDex can also map its documented duration and projection bands to one through five stars and its three value categories to two through four stars when local wear estimates are absent. These mappings carry an **Est.** label and preserve the source category. [Fragella data methodology](https://api.fragella.com/docs.html#data-methodology)
- **View on Fragrantica** and **View on Jomashop** point to reviewed editions in the [link list](links.json).

## Affordable dupes

The November 9, 2026 review records 241 relationships for 147 originals in [the dupe registry](dupes.json). A premium entry shows up to three alternatives. Saving a recognized alternative shows the original under **Dupe of**, including when the alternative has no notes profile. Both directions use the saved house, name, and format.

- **Brand-stated inspiration** links to the maker that names the original. **Community comparison** links to independent sources comparing the exact releases. The product's own concentration or format appears next to its name.
- The shortlist favors direct comparisons and named inspirations from different makers. When evidence supports fewer choices, the list is shorter. Unresolved editions and comparisons supported only by shared notes stay out.
- The server resolves both directions from the reviewed registry in the authenticated bottle profile response. Opening a citation is a separate, user-initiated action.

## Enable live scores

Set \`FRAGOUT_FRAGELLA_API_KEY\` in the server's private environment and restart FragOut. Fragella's developer account and API terms apply. The provider key stays on the server. Lookups require a signed-in non-demo account and a reviewed release year. The app checks the returned house, release, concentration, year and community-signal fields. It coalesces simultaneous lookups for the same release and limits outbound calls per account and installation. [Fragella developer portal](https://api.fragella.com/) · [API terms](https://api.fragella.com/terms-of-use.html)

## Data and permissions

| Source | Permission and use | Files |
| --- | --- | --- |
| Scento Perfume Database | CC BY 4.0. Selected note names and release facts are standardized and filtered by agreement. Each record links to the publisher's exact page. | [Dataset and terms](https://github.com/Scento-com/perfume-dataset) · [JSONL](https://raw.githubusercontent.com/Scento-com/perfume-dataset/main/perfumes.jsonl) |
| MySecretCart Fragrance Study | CC BY 4.0. Selected note names and wear estimates are standardized and reformatted. | [Study and reuse terms](https://mysecretcart.com/fragrance-study) · [CSV](https://mysecretcart.com/data/fragrance-database.csv) |
| Gouttes Rares Longevity & Sillage Index, 2026 | CC BY 4.0. Individually matched release records supply wear estimates. Green Irish Tweed EDP and Naxos EDP show those estimates alongside MySecretCart. | [Index and reuse terms](https://gouttesrares.com/pages/fragrance-longevity-sillage-index) · [September 24 JSON](https://cdn.shopify.com/s/files/1/0937/0340/5861/files/gouttes-rares-longevity-sillage-index-2026-09-24.json) |
| Manufacturer, retailer, and community pages | Direct links checked for the named release. The reviewed file identifies these pages. | [Reviewed release references](reviewed.json) |

[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

## Bottle galleries

Tap a bottle photo to enlarge it and browse available views. FragOut serves 31 JPEGs with camera metadata removed. Edition checks compare each label, barcode or documented bottle design with the exact house product page. The [photo registry](photos.json) records the photographer, source, license and caption for each file. FragDex shows these credits in **Sources & credits**.

Without an in-app photo, **Jomashop photos** opens the full retailer page for a reviewed standalone bottle. The same listing appears under **View on Jomashop** below the ratings. The checks compare the house, release, concentration and, when packaging or naming is ambiguous, the product barcode. The 2025 Light Blue EDT points to the matching 100 mL bottle. Profiles without a confirmed retailer match offer **Search Jomashop**, using the public catalog label when tapped.

Jomashop requires written authorization to reuse its photos. Its images are served by the original listing in the browser. [Jomashop terms](https://help.jomashop.com/hc/en-us/articles/11923120092571-Terms-Conditions)

## Refreshing the snapshot

Download the three licensed data files from the table to a scratch directory. Review changes to source rights, scope and exact editions before regenerating the catalog. For each new photo, check the photographer's license and the house product page. Add the resized JPEG to `public/catalog/bottles` and credit it in `photos.json` under the exact catalog ID, with the preferred cover first. Keep distinct releases separate.

```powershell
python scripts/build-fragrance-catalog.py PATH_TO_SCENTO_JSONL PATH_TO_MSC_CSV PATH_TO_GOUTTES_JSON --checked-at YYYY-MM-DD
node --experimental-strip-types --test tests/catalog.test.ts tests/route-security.test.ts
```

Snapshot input SHA-256 digests in the same order as the command above.

```text
695d9e7b5a61bb482ab84e04ae82806ca684bd26fab95b2c8e2931b6d561dfe2
acb8ce0442982cea4ed097bb3c36e228bf901809319960465f7487cfab2aca33
8b0e1c44252594f98b58fe98a964e3ae6ea53dc8ec043f9941abba5955909c74
```
