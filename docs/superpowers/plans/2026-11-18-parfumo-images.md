# Parfumo bottle image source

The user requested Parfumo's image sources for FragDex. Prefer the curated main bottle image in `/perfumes/` on `media.parfumo.com`, discovered from ordinary public fragrance/brand pages. Keep images served by FragOut, source credits, exact-edition matching, manual admin overrides and retailer fallbacks.

- [x] Test parsing of canonical pages, houses, names, concentrations, years and the main image. Reject gallery/social assets, wrong editions, redirects to other hosts, oversized files and invalid image bodies.
- [x] Implement a bounded public-page resolver and preferred provider in `src/lib/parfumo-photo.ts`, with fixed origins, no credentials and a transparent FragOut user agent. Never use Parfumo's private/disallowed API or search endpoints.
- [x] Add a repeatable public-image import command. Refresh matched existing catalog thumbnails from the same provider used for new entries, retaining working retailer images where the match is uncertain.
- [x] Visually inspect representative bottles, run tests/builds and HTTP checks, and refresh the private preview. Save the verified source and attribution records for publication.

An omitted concentration is accepted only for an independently cross-checked, single known edition. Named/reissued years must match. On otherwise unambiguous bottles, a source-year disagreement never changes the catalog year. Existing ambiguous concentrations must match explicitly. Automatic selection never depends on user photos or account details.
