# Parfumo research and FragOut implementation

Research date: 2026-11-18. This review uses Parfumo's public app page, developer articles and publicly documented workflows. It is not a signed-in usability audit or access to Parfumo's private code, data or ranking model.

## What Parfumo does well

| Capability | Primary reference | Lesson applied to FragOut |
| --- | --- | --- |
| Database-first adding and discovery | [Official app overview](https://parfumo.app/) | Choose an exact fragrance edition from FragDex, inspect it, then add it to Owned or Wishlist. |
| Include and exclude notes | [ScentMix](https://www.parfumo.com/Fragrance_Notes/scentmix) | Search recorded note names with all/any inclusion, exclusions and top/heart/base/unstaged positions. |
| Side-by-side comparisons | [Developer explanation](https://www.parfumo.com/Users/DonVanVliet/Blog/Article/perfume-comparison-discover-differences-and-similarities) | Compare concentration, release year, note pyramids, common/distinct notes and source-linked ratings. |
| Collection profiling | [Profiler article](https://www.parfumo.com/Users/DonVanVliet/Blog/Article/update-explore-perfume-collections-in-greater-detail-with-the-new-profiler) | Count common notes and houses, then tap them to filter the collection. Native profiling also supports note positions. |
| Flexible collection shelves | [Collection tools](https://www.parfumo.com/Users/DonVanVliet/Blog/Article/update-new-features-for-your-collections) | Private shelves such as Samples, Decants, Tested or Summer, alongside the existing ownership statuses. |
| Tracker calendar and most-worn scents | [Official app overview](https://parfumo.app/) | Calendar, daily entries, all-time fragrance counts and layering counts. |
| Editing dates, notes and exporting history | [Developer update](https://www.parfumo.com/Users/DonVanVliet/Blog/Article/update-002-bits-and-pieces) | Add past wears, edit their dates/notes and export the wear journal to CSV. The displayed date on this source varies by locale; this report does not infer its release chronology. |
| Compact collection views and retained sorting | [App listing](https://apps.apple.com/us/app/parfumo/id1220565521) | Remember per-account grid/list and sort preferences, with editable bottle/sample volume and remaining fill. |

## Implemented behavior

### Discovery and FragDex

The authenticated catalog browser searches **1,513 canonical editions**. **218 editions have full cross-checked note profiles**. Those counts describe FragOut's existing catalog; this work does not import Parfumo's database. Editions with incomplete metadata remain searchable by identity. Their missing notes and rating facets stay explicitly unknown.

Search filters operate on recorded names with case/diacritic normalization. All included notes or any included note can match, within a selected note position. Entries without a known pyramid, or without notes at that position, cannot pass note filters. Exclusions apply to the selected position. A recorded pyramid is not a complete ingredient or allergen declaration.

Results include concentration and available year, real catalog thumbnails, and 12-item pagination. Detail sheets reuse source-linked five-star facets, dupe relationships, photo enlargement, publisher links and image credits. Existing admin-hidden/replaced images are respected. The current automatic photo lookup runs for the exact selected public edition; search terms, private notes and wardrobe data are not sent to photo sources.

Catalog adding exposes volume and native Bottle/Sample/Decant choices. Defaults are visible and editable. A selected sample or decant creates the corresponding private shelf. Catalog identity never becomes an invented personal scent observation.

### Comparisons and related discovery

Comparisons accept a saved bottle belonging to the signed-in account or a public catalog edition. Another user's bottle ID returns 404. The view uses catalog facts, keeping personal impressions separate from published reference data.

The overlap number is the intersection of normalized listed note names divided by their union. Both editions must have notes; otherwise the result is N/A. It is explicitly labeled **listed-note overlap**. It does not claim olfactory similarity, shared ingredients, layering compatibility or Parfumo's multi-factor Similarity Score. Related editions rank by this transparent overlap and show their shared note names.

### Collection organization

Shelves are optional metadata on each private bottle. Legacy bottles remain compatible. Names are trimmed and deduplicated, limited to 12 shelves per bottle and 30 characters per name. Filters combine shelf, house, personal family, note, ownership, concentration and favorites.

Profiling counts each bottle once per note. All-notes profiling combines catalog notes with personal observations; native position filters use recorded catalog positions. Coverage and personal-rating counts are shown. Average personal ratings exclude unrated bottles. Remaining-volume totals include owned bottles only. They do not count Wishlist or Not owned as physical inventory.

Grid/list and sort settings are stored per account in a dedicated transaction that preserves photo-archive consent and all unrelated scent preferences. Least-worn sorting continues to label its recent-log window; the journal's all-time statistics use complete wear history.

### Journal

The calendar and most-worn counts read all of the current owner's real wear records, including entries older than the state endpoint's 200-activity limit. Likes, dislikes and saved pairs do not count as wears. Each bottle in a worn layer counts once toward that bottle's wear count; the layer counts as one wear event.

Users can add one or two distinct owned fragrances for a day, with a private note. Date-only entries are stored at noon in the account's IANA time zone to avoid midnight DST transitions. Invalid dates and future dates are rejected. Editing a historic entry's date or note preserves its captured names and other context, including after a bottle has been removed. The calendar uses the current account time zone, which is displayed beside it.

CSV exports include complete wear history, both fragrance names, date, occasion, time zone and the private wear note. Cells are quoted and formula-leading values are prefixed to prevent spreadsheet execution. Native exports use distinct temporary files and remove the app-owned copy when sharing returns, including on error. Account/server changes prevent sharing an earlier account's pending export. Copies the user saves outside the app are controlled by the user.

## Privacy and scope

- Catalog, comparison, view preferences, journal and CSV APIs require authentication and return `Cache-Control: no-store`.
- User IDs come from the validated session, never from a writable request field. Bottle and wear IDs are checked against that owner.
- New journal and view writes revalidate/lock the session within their owner transaction, so a revoked session cannot write a private note.
- Search/comparison/history features use deterministic catalog and owner records. No LLM is asked to invent facts, scores, wear history or community sentiment.
- The native Home/lightbulb navigation remains two primary tabs. New tools use secondary sheets; desktop tools use dialogs and collapsible sections.
- No public profiles, collection sharing, social feed, copied community reviews, cloned branding, barcode guesses, Apple Watch application or widget has been introduced. Parfumo's community-scale voting and perfume database remain separate products.

See `PARFUMO_VERIFICATION.md` for the executed checks and installation limits.
