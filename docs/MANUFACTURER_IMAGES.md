# Official manufacturer image fallback

Implemented on 2026-11-18 in response to the requested source order: **Parfumo → official manufacturer → trusted retailers**.

The same automatic selector serves newly saved public editions, the catalog scraper and admin reruns. Existing admin overrides remain authoritative. No thumbnail chooser or separate photo gallery was added.

## Selection and boundaries

- Official origins come from reviewed `house` references in the compiled catalog. Known official Shopify storefronts can discover exact products for unbundled public editions. The resolver does not follow user-supplied sites or search-result redirects.
- Product JSON, structured Product/ProductGroup data and canonical product pages establish identity. HTML-only pages require matching page title, main heading and product-image alt text. Distinct flankers, concentrations and named release years remain distinct. Missing concentration requires an independently checked profile with only one known concentration.
- Front/front-angle bottle candidates outrank other gallery assets. Packaging, overhead/rear photos, lifestyle scenes, marketing graphics and non-bottle silhouettes are rejected. A corrupt asset does not prevent trying the next eligible gallery image.
- Requests send only public fragrance identity, omit credentials and use a FragOut user agent. Page redirects stay within the reviewed manufacturer's origins. Downloads use approved HTTPS image origins/paths without following image redirects. Blocks and timeouts fall through normally.
- Metadata is limited to 2 MB; image bodies to 6 MB and 16 million decoded pixels. Accepted single-frame JPEG/PNG/WebP images must pass dimensions, MIME/decoder and isolated-bottle checks. Output is a metadata-free JPEG up to 900 pixels and 650 KB. Fingerprints prevent assigning identical output bytes to different editions.
- The official-provider runtime budget is 6.5 seconds; the maintenance importer uses 25 seconds. Bundled/previously cached photos do not require an external request. These limits do not guarantee every manufacturer's site will respond or supply a suitable picture.
- Clients load FragOut image URLs. Manufacturer/CDN requests run on the server and do not include account tokens, provider credentials, selfies, collection details or private notes. Source pages remain available through explicit source links.

## Snapshot refresh

All 29 profiles still using product-page fallbacks after the Parfumo import were checked. Eight accepted official images replaced their prior thumbnails:

| Edition | Official product page |
| --- | --- |
| Al Haramain Amber Oud Gold Edition EDP | [Al Haramain](https://shop.alharamainperfumes.com/default/haramain-amber-oud-gold-edition-75ml-eau-de-parfum.html) |
| Carolina Herrera 212 VIP EDP | [Carolina Herrera](https://www.carolinaherrera.com/ww/en/p-fragrance/212-vip) |
| Dior Miss Dior Parfum | [Dior](https://www.dior.com/en_us/beauty/products/miss-dior-parfum-Y0997166.html) |
| Jo Malone London Earl Grey & Cucumber Cologne | [Jo Malone](https://www.jomalone.co.uk/product/25946/15968/colognes/earl-grey-cucumber-cologne) |
| Kayali Yum Boujee Marshmallow 81 EDP | [Kayali](https://us.kayali.com/products/yum-boujee-marshmallow-81) |
| Lattafa Fakhar Black EDP | [Lattafa USA](https://www.lattafa-usa.com/products/fakhar-men) |
| Narciso Rodriguez For Her EDP | [Narciso Rodriguez](https://www.narcisorodriguezparfums.com/en/narciso-rodriguez-for-her/for-her-edp.html) |
| Tauer Lonestar Memories EDT | [Tauer](https://tauerperfumes.com/products/lonestar-memories) |

The eight selected photos were visually reviewed. Amouage's observed photos had a colored setting or packaging; Sol de Janeiro's observed galleries were largely overhead/lifestyle/marketing images. These failed the isolated-bottle checks. Several other manufacturers returned access blocks. Two Rabanne editions lacked a reviewed official product link. All 21 remaining entries retained their existing image. No Parfumo thumbnail was replaced.

`manufacturer-images.json` records product page, original image URL, output fingerprint and check date. `photos.json` and each profile retain attribution. These records document provenance and do not imply a reuse license.

## Verification

| Check | Result |
| --- | --- |
| Complete thumbnail audit | 218 valid JPEGs, one per full profile; no orphan files, embedded EXIF, uniform blanks or duplicate byte fingerprints. Minimum image dimension 270 pixels. |
| Distribution | 189 Parfumo, 8 newly imported official, 21 retained product-page images. |
| Image payload | 9,933,629 bytes total. |
| Catalog fact comparison | Notes, ratings, evidence, identities and non-photo sources unchanged. |
| Unit/security/regression suite | 249 passed, 0 failed, including 13 new official-provider tests. |
| Strict TypeScript | Passed. |
| Production preview build | Passed; publication audit checked 11 traces and 248 public assets without private databases, keys, environment files or source maps. |
| Private HTTPS/iPhone web bundle | Certificate, mobile page, script, health endpoint and unauthenticated API denial verified. |
| Live thumbnail/API checks | 699 assertions passed. All 218 served JPEGs matched their verified files byte-for-byte; all eight official profile credits and paths matched the registry. |
| Discovery/journal HTTP regression | 133 assertions passed against the rebuilt preview. Disposable test accounts were deleted afterward. |

The existing cached Fahrenheit sample still resolved through first-priority Parfumo (add: 6 ms, profile: 4 ms). This was a cache regression check, not a new uncached procurement benchmark. Tests did not use personal accounts or images. The preview is available on the existing private Wi-Fi HTTPS endpoint; this report does not claim a new signed native build, physical-device acceptance or public cloud deployment.

## Refresh

```powershell
npm run catalog:photos:manufacturer
npm run catalog:photos:manufacturer -- --ids tauer-perfumes-lonestar-memories-edt --refresh
```

The import preserves the first-priority Parfumo images, caches only public responses outside packaged directories, uses two workers with spaced network starts and retains previous thumbnails on uncertainty. The shared backend supplies image updates to web and native clients; this change does not require new camera/native APIs or claim physical-device or App Store verification.
