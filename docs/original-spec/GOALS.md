# FragOut — goals and release boundaries

## North star
With a user's *real* fragrance wardrobe and current context, FragOut can suggest one or more wear-worthy fragrances and source-grounded layering combinations, explaining *why* and *how confident* it is.

## Primary personas
- Collector with 5–100+ bottles who wants a fast answer instead of indecision.
- Enthusiast who owns clones/inspired-by scents and seeks layering combinations without buying originals.
- Newcomer who wants a clear explanation of notes, seasons, projection, and etiquette without jargon.

## MVP must-haves
- Account and private scent portfolio; text search, manual fallback, camera/gallery upload and confirm.
- Canonical fragrance catalog with variants, official/published note pyramids when allowed, accords/families, concentration and community performance with provenance.
- Home dashboard with fixed shortcuts: `Recommend`, `Combo`, `Gym`, `Date`, `Work`, `Party`, `Errands`, plus reorderable/renameable custom occasion shortcuts (minimum two predefined editable templates).
- Context from location-permitted weather, season, local time, with manual city/forecast override and indoor/outdoor context.
- Ranked owned-fragrance recommendations with short reasons, climate/venue fit, intensity advice, and feedback actions.
- Combo flow asks occasion after context, suggests 2 owned fragrances, distinguishes direct observed combos from dupe-adapted and novel/experimental.
- Evidence details with source link, tier, and last-reviewed date; bad/missing data never shown as established.
- Preference setup (liked/disliked notes, fragrance strength, style, sensitivity, exclusions), favorite ratings, and history.
- Privacy and error handling, accessibility, source/license audit, tests.

## MVP excludes
- In-app sales, price tracking, affiliate links, commerce, ad monetization.
- Public posts, follower network, bulk social scraping, influencer video downloading/transcription without rights.
- Full global catalog, image-perfect identification of unlabeled lookalike bottles, unconditional claims of verified dupe identity.
- AI chatbot as the sole ranking engine; consumer-facing unverified numeric longevity guarantees.

## Success/quality gates (initial product targets; measure and adjust)
1. Every recommendation returns only Owned IDs; automated invariant must show 100% pass.
2. Seeded core 50 catalog products/variants are manually audited with zero identity/variant mixing.
3. In 100 labeled image test cases, display **top 3** candidates and achieve ≥90% inclusion for clear labeled front-bottle photos; for ambiguous/blurred cases **abstain or request confirmation** rather than auto-add. Report sample composition and misses. This is a target, not a claimed model result.
4. 100% of displayed established combos meet evidence eligibility gate and have links; substituted combos use distinct labels.
5. With seed inventory, Recommend/Combo/Gym/Date/Work/Party/Errands all work end to end including empty states and manual context.
6. For 30 representative scenario test fixtures, no critical venue exclusions or disliked-note constraints are violated; domain-ranker regression suite is reproducible.
7. No unauthorized catalog data extraction; launch source-license review is complete.
8. Mobile critical flows usable with keyboard, screen reader labels, and touch targets; no inaccessible essential action.

## Future (not blockers)
Daily scent calendar, occasion presets and widgets, travel capsule suggestions, combination A/B feedback, wishlist/discovery, wear analytics, family recommendations, fragrance rotation, native mobile apps, photo multi-bottle detection, licensed influencer feed, community-curated evidence.

## Open product decisions
- Will FragOut remain collection-first or become a discovery/shopping marketplace?
- Should experimental combos be opt-in only or offered after exhausting substantiated combos? **Current default:** opt-in.
- How should users handle multiple editions and concentrations? **Current default:** distinct catalog variants.
- Which external data feeds are licensed/allowed for commercial distribution? Must decide prior to broad ingest.
