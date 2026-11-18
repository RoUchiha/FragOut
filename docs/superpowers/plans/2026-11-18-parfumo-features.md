# Parfumo-inspired collection tools implementation plan

**Goal:** Bring catalog discovery, comparisons, collection profiling, shelves and a complete wear calendar into FragOut's existing two-tab mobile app.

**Architecture:** Reuse the sourced FragDex catalog and private owner-scoped store. Shared pure helpers serve mobile and desktop; catalog reads and all journal operations remain authenticated. Retain Next.js and Expo SDK 58 without new dependencies.

**Authorization:** The user asked to research and copy as much as possible from Parfumo and previously delegated implementation details. Execute in this session.

## Constraints and review focus

- Keep Home and the lightbulb as the two primary tabs; secondary tools open sheets.
- Unknown catalog facts stay unknown. Note overlap is explicitly a comparison of listed notes, never a smell-match score.
- No private collection, wear note, photo or credential is sent to Parfumo.
- Comparisons must reject foreign bottle IDs. Catalog photos must respect admin overrides and hiding.
- Journal statistics and CSV use all owner wear records, including records older than the state endpoint's 200-entry window.
- Validate dates in the wearer's time zone, retain old entries after bottle removal, and escape spreadsheet formulas in CSV.

## Tasks

- [x] Add discovery and comparison tests, run them, then implement `src/lib/catalog-discovery.ts` with authenticated search/detail/compare routes. Test staged include/exclude notes, empty metadata, pagination and foreign IDs.
- [x] Extend optional bottle metadata with shelves and editable sample/decant volume. Add pure collection profiling/filtering tests and preserve legacy records.
- [x] Add journal helper/store/route tests, then implement month views, all-time statistics, date/note edits and CSV. Test privacy, DST, invalid/future dates, deleted bottles and more than 200 entries.
- [x] Implement compact mobile CatalogBrowser, comparison and collection-profile sheets; integrate the add chooser and shelves into Collection. Reuse source ratings and links.
- [x] Replace the recent-history journal with calendar, add/edit wear and export, retaining feedback and saved looks. Bring the same tools to the desktop web entry point.
- [x] Record primary-source research and coverage. Run unit/API tests, type checks, mobile lint, web and native exports, production build, private HTTPS smoke and staged secret scan. Refresh the local iPhone preview and commit the verified change.

## Verification

`npm test`, `npm run typecheck`, `npm run lint --prefix mobile`, `npm run typecheck --prefix mobile`, `npm run export:web --prefix mobile`, `npm run build`, iOS Expo export and an authenticated HTTPS feature smoke test.
