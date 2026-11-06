# Recommendation and layering engine specification

## Principle
Use a **hybrid system**: a deterministic, testable scoring/rules engine over a source-grounded catalog and private wardrobe; AI for image interpretation, grounded explanations and **explicitly exploratory** pairing candidates. Never allow an LLM to return an unowned fragrance or manufacture evidence.

## A. Context resolver
1. Determine event timestamp/time zone (user chose future event overrides current moment).
2. Obtain location permission only when requested; use manual city or user-provided weather otherwise. Do not need street-precise location.
3. Fetch event-time forecast where available, with freshness/coverage checks. Record current vs forecast vs user override and provider attribution.
4. Determine local daytime/evening, hemisphere-adjusted season, feels-like and precipitation/humidity bands, indoor heating/AC unknown unless set.
5. Resolve shortcut occasion configuration and user profile; require occasion choice in `Combo` if not supplied.
6. Return context and missing-field flags; never pretend weather was retrieved if it wasn't.

## B. Solo recommendation
1. Load only owned, eligible user bottle variants; deduplicate optional identical bottles for ranking.
2. Apply HARD constraints: `NO_FRAGRANCE` venue, user blocked notes/scents, banned specific products, unowned, unavailable/unidentified if product data insufficient. For `NO_FRAGRANCE`, return `No fragrance advised` rather than rankings.
3. Construct normalized feature vector for each candidate: climate fit, occasion/venue fit, projection/social appropriateness, duration fit, personal preference, evidence quality, style variety/recency.
4. Rank with configurable weighted transparent model. Suggested baseline (requires calibration): occasion/venue 25%, climate 20%, projection appropriateness 20%, personal affinity 20%, duration 10%, variety 5%. Data availability and confidence adjust *result confidence* and may lower rank, never fabricated precision.
5. Use guardrails: gym = fresh/light and conservative projection; office = unobtrusive; date = close quarters contextual to preference; club/party may tolerate stronger; errands = flexible. Settings and user preferences can refine venue assumptions.
6. Return top 3, reasons from actual features, explicit uncertainty. For only 1 fragrance, still return it only if acceptable; otherwise no confident match.
7. Learn from user's direct feedback without distorting sourced facts; explain when recommendations change due to personal taste.

## C. Combo candidate generator
1. From the owned variants, generate all unique 2-product unordered pairs (or use indexed restricted retrieval for large portfolios).
2. Look for direct reviewed `layering_combos` for exact variants.
3. Optionally, if evidence-backed exact pair unavailable or lower fit, look up curated pair A+B where user has A′+B; A′ must have a verified directed dupe edge to A; calculate differences and downgrade to `dupe_adapted_hypothesis` regardless of original evidence tier. **Default presentation:** keep direct evidenced pairs first; show dupe variants only after clearly marked opt-in/section.
4. In single-anecdote mode, allow valid direct single author reports; never call them corroboration.
5. If user chooses exploratory mode, generate unobserved pairs using complementarity/contrast heuristics and avoid obvious clashes. Mark `model_hypothesis` even if the notes seem compatible.
6. Apply weather, setting, projection combined-load, liked/disliked and negative-report constraints. Avoid default two aggressive projection scents in a gym/office, even if community liked them elsewhere.
7. Score pair relevance using tier/evidence strength, weather, occasion, balance, user preferences, confidence and negative evidence; never confuse source popularity with independent outcomes.
8. Provide why, caveat, potential dominance, and a **small starting application suggestion** grounded in product strength (e.g., fewer sprays of stronger scent), without promising precise ratios.
9. Give exact original cited recipe when source allows, plus an explanation of any variation (replaced fragrance, expected note/performance shifts).
10. Never suggest physically mixing fragrance liquids in a shared container.

## D. Data-limited fallback
- Weather unavailable: ask to use manual conditions or use generic occasion ranking with clear disclosure.
- Unsupported bottle: allow manual logging and preferences; refrain from false note-specific claims.
- Wardrobe 0: onboarding to add first bottle.
- Wardrobe 1: solo suggestions only; Combo says at least two Owned fragrances required.
- Wardrobe >=2 but no evidence-backed pairing: show truthful “No documented pairing in your collection yet” and optional **Explore experimental** toggle. Do not invent two sources to force a result.
- Contradictory performance reports: display range/uncertainty; account for user preference.
- Invalid photo match: return suggestions/request clearer image, never auto-add.

## E. Ranking pseudocode

```text
recommendSolo(user, event):
  context = resolveContext(event)
  owned = listCanonicalOwnedVariants(user)
  if context.venuePolicy == NO_FRAGRANCE: return noFragranceReason
  candidates = hardFilter(owned, user.exclusions, context)
  ranked = sortByScore(candidates, evaluateFit(context, user))
  return renderGroundedReasons(ranked.take(3))

recommendCombos(user, event, evidenceMode):
  context = resolveContext(event + required occasion)
  owned = listCanonicalOwnedVariants(user)
  direct = findVerifiedExactPairs(owned)
  adapted = evidenceMode.allowsDupe ? inferDupeAdaptedPairs(owned) : []
  single = evidenceMode.allowsSingle ? findSingleReportPairs(owned) : []
  proposed = evidenceMode.allowsExperimental ? generateNewPairHypotheses(owned) : []
  pool = annotateTier(direct, adapted, single, proposed)
  return rankPairs(hardFilter(pool, user, context)).take(3)
```

## F. Explanation contract
Reasons must refer to facts/rules in context such as `TEMP_HOT`, `VENUE_LOW_PROJECTION`, `USER_LIKES_CITRUS`, `PAIR_COMMUNITY_CORROBORATED`, `DUPE_DRYDOWN_DIFFERS`. Each reason includes linkable `claimIds` or heuristic version and may include an uncertainty note. AI may write friendly prose but must not invent missing claims or certainty.

## G. Example scenario fixtures (not factual recommendations)
- `gym_hot`: 94°F feels-like, humid, dense indoor gym, owns 1 airy citrus and 1 heavy amber; airy citrus ranks highest or scent-free if preference; heavy amber excluded/strong penalty.
- `office_cold`: 38°F outside but heated indoor shared office, heavy resin and subtle musk owned; avoid assuming cold outdoor climate alone justifies beast-mode scent indoors.
- `date_evening`: 64°F, dinner in intimate venue; compare sweetness, projection and user likes; modest application.
- `dupe_pair`: documented source pair A+B, only owns A′ clone and B; result is **dupe-adapted hypothesis** even if A+B is brand-suggested.
- `zero_evidence`: owns X and Y, no accepted direct evidence; evidence-only mode yields no pair, experiment opt-in may generate X+Y without fabricated citation.

## H. Evaluation rules
Log aggregate latency and anonymized reason code frequencies; compare quality by blinded human rubric and explicit user success/failure, not likes/upvotes alone. Version weights and reevaluate on each research publication. No hidden model behavior that bypasses hard constraints.
