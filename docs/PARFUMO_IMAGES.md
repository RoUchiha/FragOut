# Parfumo image source and verification

Implemented and verified on 2026-11-18.

## Source investigation

Parfumo accepts official images and press material from brands through its [press-material submission workflow](https://www.parfumo.com/support.php). Its [main-image guidelines](https://www.parfumo.com/forums/topic/how-to-propose-a-main-picture-for-fragrances) favor a clear bottle without packaging, a white background and no watermark. The community photography gallery is a separate feature.

The public fragrance page's main bottle is its `img.p-main-img[itemprop="image"]`. The observed main-image host/path is `https://media.parfumo.com/perfumes/`. For example, the [Sauvage EDP page](https://www.parfumo.com/Perfumes/Dior/Sauvage_Eau_de_Parfum) links to [this bottle image](https://media.parfumo.com/perfumes/a0/a0ef46-sauvage-eau-de-parfum-dior_1200.jpg?width=1000&quality=90).

The page's `og:image` is a social card under `/perfume_social/`; it is not the clean bottle thumbnail. Images under `/user_imagery/` belong to the gallery. Neither path is eligible for FragDex thumbnails.

## What changed

- **189 of the 218 full FragDex profiles now use Parfumo main bottle images.** The other 29 retain their existing retailer image because a Parfumo edition could not be confirmed reliably.
- Every profile still has exactly one thumbnail, with tap-to-enlarge behavior. No gallery or separate bottle-photo feature was introduced.
- The automatic creator now tries this same Parfumo provider before its retailer fallbacks. It applies to supported public catalog editions, including entries without a bundled image.
- `catalog/parfumo-images.json` records canonical source pages, original CDN URLs, image fingerprints, validation basis and check dates. `catalog/photos.json` retains image attribution. No reuse license or ownership is inferred from the source's availability.
- Images are decoded, checked, stripped of embedded metadata and cached as JPEGs served by FragOut. Native/web clients load FragOut URLs; they do not send their IP, account token, collection or photos to the source CDN to display a thumbnail.
- Existing admin replacements and hidden-photo settings continue to take precedence.

## Selection checks

The resolver checks the canonical public page, structured breadcrumb house/name, concentration or independent catalog evidence, named/reissued years, main-image alt label and permitted image host/path. Common spelling, translated-label and brand-subline differences are normalized narrowly. Distinct flankers remain distinct.

An absent concentration can be used only for an independently cross-checked profile whose normalized release name has one known concentration. Actual concentration suffixes are removed consistently when detecting ambiguity. A word such as "Le Parfum" inside a flanker name is not automatically assigned as its concentration. Named reissues must match their year. Conflicting source years do not change FragDex facts.

The provider rejects social/gallery/notes images, non-image responses, overly small or large images, embedded multi-frame content, uniform blank images and redirected image requests. Page redirects are bounded and confined to the same public product origin. Requests omit credentials and use an explicit FragOut user agent. Public brand/product pages are used; Parfumo's private and crawler-disallowed API/search endpoints are not used.

Image fingerprints also guard against assigning identical bottle pixels to different editions. The import checks collisions before applying results; conflicting candidates retain the previous thumbnail.

## Issues found and corrected

The first import exposed a resolver mistake: an unqualified Acqua di Giò page had been allowed to satisfy both EDT and EDP. The two generated thumbnails had identical bytes. Concentration ambiguity now normalizes format suffixes consistently, a regression test covers both editions, and the complete import was rerun from the previous verified asset set. Both uncertain candidates retained their retailer images.

The image audit also found the previous Libre Intense retailer thumbnail was only 169 pixels wide. Its replacement is a larger, clear Parfumo bottle image, matched to the explicitly listed Eau de Parfum Intense edition.

## Executed verification

| Check | Result |
| --- | --- |
| Complete image-file audit | 218 valid JPEGs; no embedded EXIF, uniform blanks, undersized images under the audit threshold or duplicate image bytes. |
| Source distribution | 189 Parfumo, 29 retained retailers. |
| Image payload | Approximately 10 MB for the 218 files. |
| Unit/security/regression tests | 236 passed, 0 failed. |
| Strict root TypeScript | Passed. |
| Production build and public-asset audit | Passed; 11 traces and 248 public assets, with no private database, keys, environment files or source maps published. |
| HTTPS preview verification | Passed. |
| Live image/API checks | 667 assertions passed; every one of the 218 served JPEGs matched its local file byte-for-byte. |
| Discovery/journal HTTP regression | 133 assertions passed against the rebuilt preview. |
| New uncached entry | Adding Fahrenheit EDT returned in 15 ms; its first profile/image procurement completed in 1,545 ms and stored a Parfumo-credited image behind FragOut's image endpoint. |

The new-entry measurement is one local HTTPS sample, not a latency guarantee. Its catalog image was absent from the shared cache before the test. Later additions reuse the cache.

Representative images were visually inspected: Sauvage EDP, 9PM, Layton, Libre Intense and Le Male Le Parfum. The complete catalog received automated file/content checks; it was not a manual visual audit of all 218 bottles. No physical-device acceptance test or signed native build is claimed. Image-source changes are delivered through the shared backend to the existing mobile clients.

## Re-run

```powershell
npm run catalog:photos:parfumo
npm run catalog:photos:parfumo -- --refresh --max-pages 5
npm test
node tests/http-images.mjs
node tests/http-discovery.mjs
```

`--ids id1,id2` limits an import to exact full-profile IDs. The importer caches public responses outside app assets, limits public brand pagination to at most five pages, spaces network starts and retains previous images on uncertain matches. Set `FRAGOUT_TEST_URL` and, for the private preview, `NODE_EXTRA_CA_CERTS` before HTTP tests. TLS verification should remain enabled.
