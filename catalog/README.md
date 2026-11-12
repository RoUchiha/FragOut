# Fragrance catalog

The catalog covers 218 exact releases from 65 houses, including designer bestsellers, niche lines, classics, and affordable fragrances. Every entry has corroborated notes and a bundled bottle thumbnail. Ninety-six have at least one sourced wear estimate. Fifteen have exact Fragrantica links and 77 have exact Jomashop listings.

The app compares the saved house, release, and concentration with this snapshot on the FragOut server. It keeps EDT, EDP, cologne, parfum, extrait, elixir, and mist separate. Where a label and concentration have documented reformulations, enter the edition year as part of the name to select that profile. Unlisted editions save as a basic entry. The server uses the local snapshot for the initial result, and the optional live rating lookup sends only the public catalog identity. Saved bottles and their profile lookups require the owner's session. Label scans and personal observations follow their private flows.

## Evidence

- The compiler retains note names found in two or more source records for the same edition. It standardizes selected synonyms at the shared level of detail. A note gets a top, heart or base label when two references agree on the stage and every published placement agrees. Otherwise it appears in the general notes list.
- For Green Irish Tweed EDP and Naxos EDP, the profile shows the two wear estimates side by side. MySecretCart compiles typical wear from published information and wearer reports. Gouttes Rares publishes in-house ranges and uses its sillage field for assessed throw. Different wear methods and scales keep their own labels. Oud for Greatness was held out of the performance comparison because the Gouttes listing and the house use different concentration descriptions.
- Official pages and exact retailer listings corroborate short note names and identity. Parfumo links open the exact edition as a community reference.

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

## Bottle thumbnails

FragDex shows one front or three-quarter bottle photo and enlarges the same image on tap. Photos are selected from web image results and manufacturer or retailer product pages, then bundled as optimized JPEGs. The [photo registry](photos.json) records each product page, original image URL, view, and caption. Credits appear under **Sources & credits**.

Saving or editing a recognized public edition queues photo lookup when it needs a thumbnail. FragDex checks the seller's search result and product record for the exact house, release, concentration, and any distinguishing year. It checks that the image belongs to a full-size product and screens for packaging, alternative views, and poorly isolated bottles. It stores accepted photos as cleaned JPEGs with the product source. Edits and simultaneous saves share the cached result. An ambiguous or unavailable result leaves the entry eligible for retry.

The catalog and the public edition index supply the query labels. Custom labels and personal images stay within their own account flows. Both bundled and discovered thumbnails load from FragOut.

### Photo administration

Create and sign in to your FragOut account. From the FragOut project directory, grant the account access to the shared catalog on the same server.

```powershell
npm run catalog:admin -- grant "your-account@example.com"
```

Open **Settings → FragDex photos**. Search by house, release, concentration, or edition year. Select an entry to upload a replacement, hide its photo, restore its default, or rerun an automatic lookup. A replacement is shared across the catalog and takes precedence over automatic results. Use `revoke` in the same command to remove access. The grant command uses the server's `FRAGOUT_DB` if it is configured.

## Refreshing the snapshot

The scraper stages the three datasets above and builds a draft snapshot. It runs the same automatic photo selection on entries that need a thumbnail. The report includes the selected photo, its product page, and an exact Google Images link for investigation. The run folder contains the selected JPEGs and an import manifest for eligible catalog entries.

```powershell
npm run catalog:scrape -- --out ../catalog-review
npm run catalog:scrape -- --out ../catalog-review --photos-only --edition scento:dior-fahrenheit-toilette
```

Use `--limit` and `--offset` to select a group of entries missing thumbnails. The default group has ten editions. Repeat `--edition` to review specific public IDs or use `--data-only` for the notes and ratings refresh. The batch tool uses Node and Python.

Use `selected-photos.json` from a successful run to bundle those photos with the snapshot. Each record includes the exact catalog ID, local image filename, view, publisher, product page, original image URL, credit, and caption. The importer resizes photos, removes camera metadata, and updates the registry. Use `--replace-all` with one photo per edition to replace the registry. Rebuild the catalog before removing retired image files.

```powershell
node scripts/import-fragrance-photos.mjs PATH_TO_REVIEWED_PHOTOS.json
python scripts/build-fragrance-catalog.py PATH_TO_SCENTO_JSONL PATH_TO_MSC_CSV PATH_TO_GOUTTES_JSON --checked-at YYYY-MM-DD
node --experimental-strip-types --test tests/catalog.test.ts tests/route-security.test.ts
```

Snapshot input SHA-256 digests in the same order as the command above.

```text
695d9e7b5a61bb482ab84e04ae82806ca684bd26fab95b2c8e2931b6d561dfe2
acb8ce0442982cea4ed097bb3c36e228bf901809319960465f7487cfab2aca33
8b0e1c44252594f98b58fe98a964e3ae6ea53dc8ec043f9941abba5955909c74
```
