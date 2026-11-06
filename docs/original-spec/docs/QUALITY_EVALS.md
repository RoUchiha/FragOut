# Quality, evaluation, privacy, and release gates

## Test pyramid
- **Unit:** variant name normalization, hemisphere/season, timezone, temperature classification, weather freshness, scoring weights, hard exclusions, source eligibility, dupe adaptation downgrades.
- **DB/integration:** user ownership isolation, manual entries, migrations, cascade deletes, license approval gating, source attribution integrity, combo exact-variant matching.
- **API:** authenticated upload, image validation, rate limiting, model JSON validation/abstention, weather outage, retry and error handling, approved research publish, no model-generated facts without citations.
- **E2E:** add by typing; add via image and confirm; browse/modify/delete portfolio; every built-in shortcut; custom shortcut; Recommend; Combo occasion; opt-in experimental; personal feedback; deny location; delete/export data.
- **Human eval:** blinded reviewer compares top 3 vs context; 20 direct pairs and dupe adaptations; disagreements recorded rather than ignored.

## Required deterministic tests
1. `owned_only`: every solo result belongs to authenticated user's Owned variants.
2. `combo_owned_only`: both pair IDs belong to authenticated user's Owned variants and are different.
3. `strict_venue`: `NO_FRAGRANCE` returns no spray recommendation; `LOW_SCENT` penalizes/excludes high-projection based on policy.
4. `evidence_no_launder`: one Reddit report remains single; A+B brand source does not prove A′+B.
5. `license_gate`: source with `prohibited`, `link_only`, or `review_required` cannot publish restricted scraped note content.
6. `variant_precision`: EDT != EDP != Elixir and named flankers distinct.
7. `weather_override`: manual context supersedes provider with clear source label; API outage never silently invents live weather.
8. `empty_wardrobe`: prompt to add, no phantom recommendation.
9. `wrong_candidate`: photo vision low confidence and no source catalog match leads to user confirmation/manual fallback.
10. `separate_user`: user A's private wardrobe/photos/feedback never returned to user B.
11. `strong_scent_gym`: high combined projection can't bypass gym policy via a high community vote.
12. `traceability`: each material recommendation reason has versioned rule ID or approved claim IDs.

## Fragrance-specific gold datasets
- 100 photos across known clear front/back, partial flanker text, decants, ambiguous bottles, poor lighting and duplicates. Report recall@3, coverage, abstention precision, and false auto-confirm (must be zero: all require user choice).
- 30+ scenario contexts including hot/humid, hot/dry, winter indoor heat, cool late-night, crowded gym, scent-free venue, rainy commute, future event in another zone, weather failure.
- 20 evidence-tier examples with exact product variants, 20 dupe-path edge cases including alternative with very different drydown, 10 contradictory community reports.
- 50 initially audited catalog entries then 100+ for beta; sample across masculine/feminine/unisex markets, luxury/affordable, niche/designer/dupe houses; do not let one community or brand dominate.

## Quality measurements (targets, not current results)
- All hard-invariant tests green: 100%.
- Rec@3 ≥90% on defined clear labeled photos, with caveats for set size and model version. Ambiguous cases must abstain/ask.
- 100% of `community_corroborated` pairs have ≥2 independent eligible source reports; all brand-suggested pairs have a direct primary source.
- 100% of established combo UI cards expose source links and evidence tier.
- Source rights matrix coverage: 100% publishable claims and assets reviewed.
- Accessibility audit: critical flows operable with keyboard/voiceover-like screen reader plus color/contrast review.
- Define latency, error budget, rate limits and per-user model spending from benchmark measurements in phase 0; do not invent SLA numbers before measurement.

## Risks and mitigations
- **Hallucinations/overconfidence:** retrieval-anchored structured facts and explicit abstention.
- **Wrong bottle identification:** exact variant candidates and required confirmation.
- **Inaccurate dupe substitution:** directional evidence, note difference disclosure, experimental downgrade.
- **Unrepresentative Reddit opinion:** independent-source counts, contradictory accounts, personalization and no vote-only scores.
- **Licensed data exposure:** record rights before collection, avoid mass scraping, remove unsupported assets on takedown.
- **Location/photo privacy:** manual mode, consent, private storage, bounded TTL, retention/erasure, no sensitive logs.
- **AI/provider spend:** backend keys, quotas, photo resizing and cache, model fallback, batch cost reporting.
- **Inappropriate scent intensity:** conservative public venue assumptions, scent-free option, user override only where permitted.

## Release gate
Document test command outputs, failed cases and actions taken, catalog/evidence rights audit, security controls, data export/delete demonstration, fallback behavior, provenance UI screenshots, reviewed source matrix, and deployment approval. Never treat high engagement alone as correctness.
