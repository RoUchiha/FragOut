# Research and evidence specification

## Primary objective
Create an extensive but **auditable** fragrance knowledge base used by deterministic ranking and retrieval-aware explanations. Codex research is a data production workflow with permissions, source identification, uncertainty, human approval and tests, **not** a one-time unsourced report or a production live scraper.

## Important conceptual separation
1. Product identities, release/variant/concentration and brand-declared notes: factual claims, each with source URL and record date; note pyramids describe marketing/perception rather than literal formulas.
2. Fragrance families/accords: taxonomies or community perceptions; conflicting descriptions allowed.
3. Performance: individual/context-sensitive estimates (projection, duration and sillage), not guaranteed facts. Note skin, weather, application, batch and observer variance.
4. Season/occasion suitability: heuristics and population preferences, not objective rules. Label rules as evidence-backed, expert guidance or hypothesis.
5. Layering: a specific report about a specific pair, with context (if known). Never treat general note complementarity as proof that two complete products layer well.
6. Dupes: directed similarity *opinion/claim* supported by links; do not assert chemical equivalence.

## Source order and reliability
- **Primary:** brand/manufacturer product pages, official perfume-house pairing recommendations, permitted manufacturer feeds or explicitly licensed catalog data.
- **Expert educational:** trade/education resources, published fragrance family material, perfumer interviews and approved industry research.
- **Firsthand community:** Reddit, Basenotes, Parfumo, forums, relevant influencer posts/videos when access and reuse are authorized. A source saying they actually wore the pair is stronger than speculation or a repost.
- **Retailer/blog:** useful secondary descriptions and comparisons; detect ad/affiliate incentives, duplicated descriptions and sponsorship.
- **Model-generated claims:** proposals only; cannot become established evidence through repetition or synthetic sources.

## License/rights gate (mandatory)
Before ingesting each source, record provider, URL, terms URL, access method, allowed activities, commercial use status, permitted fields/storage/attribution, date reviewed, reviewer, restrictions, and expiration. Status: `approved`, `link_only`, `review_required`, `prohibited`. If not `approved`, never materialize third-party catalog/reviews/images into publishable DB.

**Known warnings (checked 2026-11-05):**
- Fragrantica terms prohibit unauthorized automated access and commercial reuse of its content, including structured fragrance notes/reviews. Do not crawl it, use unofficial endpoints, or copy its database without permission. https://www.fragrantica.com/Terms-of-Service.phtml
- Open-Meteo free API is noncommercial; a paid/commercial plan is required for an ad/subscription or commercial app. https://open-meteo.com/en/terms
- Reddit and other communities have terms/rate limits; do not assume publicly viewable content is licensed for ongoing ingestion or reuse. Prefer a link with minimal attributed observation and verify legal basis and access restrictions.
- Product bottle images may be protected. Use user-owned photos privately or licensed brand media; never casually hotlink/scrape copyrighted bottles.

## Research-track outputs

### R1: Fragrance fundamentals
Structured topic pages: note families (fresh, citrus, floral, aromatic, fougère, woody, amber, gourmand, leather, chypre, aquatic etc.), concentration, top/heart/base, accords, projection vs sillage, climate interactions, layering approaches, settings etiquette, evidence conflict. Explicitly label heuristics, not rules.

### R2: Canonical fragrance database
For each variant: house_id, line_id, canonical display name, alias names, concentration, flanker, edition/year/reformulation if identifiable, note pyramid + source, accords/family + source, performance observations + source, licensed image or null, confidence and review status. Never collapse EDT/EDP/parfum variants silently.

### R3: Dupe/inspiration graph
Directed edge from `candidate_variant` to `reference_variant`, with relationship type `brand_claimed_inspired_by`, `community_compared`, `shared_style`, or `weak_speculation`; scores by opening, drydown and overall; perceived differences in sweetness/woodiness/smoke/projection; source links and independent reporting authors; version-specific caveats. Edges are *not* identity aliases.

### R4: Layering combinations
Observe pair A+B, identity and concentration, reporter first-hand vs hearsay, author identity/hash (to deduplicate only, avoid personal data), medium/provider, URL, publication date, quote-length/commercial rights flag, order/ratio if stated, conditions, positive/negative outcome, conflicts, reviewer date. Separate direct brand suggestion, corroborated community, single anecdote, and experimental inference.

### R5: Scenario and evaluation data
Cold, hot/humid, dry heat, rainy, day/night, outdoor party, indoor office, gym, date, errands, public transport; explicit user tastes, exact wardrobe, ideal/acceptable/avoid list with human review; counterfactual variant mismatches and dupe mismatches.

## Evidence-classification policy
- `brand_guidance`: exact named pair explicitly recommended by a fragrance house. Display “Brand-suggested,” not independent outcome validation.
- `community_corroborated`: at least 2 independent first-hand accounts naming the **same exact variants**, with retrievable links and no evidence of recycled attribution; reviewers record contrary findings. This is a launch heuristic, not statistical proof.
- `single_anecdote`: only one unique first-hand report, possibly compelling, never presented as consensus.
- `dupe_adapted_hypothesis`: source-supported original pair with one or more substituted products; requires a documented dupe edge; **not** evidence of wearing the new pair.
- `model_hypothesis`: candidate based on accord/contrast/performance context; clearly marked untested.
- `negative_report`: observed mismatch or overbearing combo; use to rerank and warn.

At render, expose tier, report count if lawful to store, source links, last reviewed, and context limits. No numeric confidence precision without calibration.

## Research workflow for Codex
1. Define a **bounded batch**, e.g. 25 catalog variants, 20 prospective dupe edges, or 15 pair reports. Set data rights and intended use.
2. Search/review allowed primary sources and permitted community material; collect metadata + pointers. Never use unauthorized automation.
3. Extract candidate schema-conforming records with field-level citations; save unknowns as null; preserve conflicts.
4. Deduplicate syndicated claims and variant identities; score certainty at claim and edge levels.
5. Second-pass reviewer independently verifies names, concentrations, key claims, rights and provenance.
6. Produce `research/batches/<id>-findings.md` plus machine-readable rows, rights matrix and rejection log.
7. Validate schema, URLs, independent reports, unlicensed content rejection; audit random samples.
8. Approve/publish catalog versions with rollback; recalculate affected recommendations and report coverage.

## Suggested initial approved/manual seed sources for policy research
- Official Jo Malone pairing philosophy and examples: https://www.jomalone.com/scent-pairing ; https://www.jomalone.com/our-stories/fragrance-layering-tips
- Industry fragrance families: https://perfumesociety.org/discover-perfume/an-introduction/fragrance-families/
- Community candidate *links*, not ingestion authorization: https://www.reddit.com/r/fragrance/comments/1hh1hbc/ ; https://www.reddit.com/r/fragrance/comments/1jws2r1/ ; https://www.reddit.com/r/Perfumes/comments/1tzksxz/layering_fragrances/
- Basenotes pairing discussion (rights review necessary): https://basenotes.com/threads/do-you-or-have-you-ever-mixed-2-fragrances-together.437330/

## Research biases and controls
- Enthusiast forums overrepresent prestige, loud fragrances and active posters; avoid equating upvotes with controlled reliability.
- Affiliate/influencer incentives may distort positive reviews; label sponsorship, affiliate status or unknown.
- Sources and label pyramids vary by region/edition; preserve conflicts and region.
- Ranking should not overfit brand popularity or gendered marketing; user ratings and constraints can outweigh prestige.
- A negative or minority experience is still useful; include opposing evidence.

## Governance and freshness
- Track per claim: `valid_from/observed_at`, `last_verified_at`, `license_status`, `reviewer`, `status`, `citation_ids`.
- Schedule periodic verification by changes/usage, not blind full-site scraping.
- On DMCA/license withdrawal or requested removal, retract prohibited content, recompute derived outputs if necessary, preserve a non-infringing audit log.
- Every research batch publishes counts: candidates, accepted, rejected, disputed, insufficient, rights-blocked, URLs checked, human verification percentage.
