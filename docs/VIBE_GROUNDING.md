# Layering vibe audit and backend tuning

November 24, 2026. This follows the [direct Qwen/Sol experiment](LAYERING_MODEL_COMPARISON.md). The recorded raw model outputs and their failing acceptance result remain unchanged. No new model inference was run for this follow-up.

## Were the overall vibes similar?

Partly. Both models could produce a fresh direction, but the local 2B Qwen repeatedly reused fresh anchors for cozy, mysterious, warm and bold requests. The earlier exact-recipe overlap was only 3/24 slots across the eight discretionary cases. Broad direction overlap is more forgiving than recipe identity, but it still does not establish comparable reliability.

For a transparent follow-up, we classified the supplied notes in the ten thematic cases using fixed primary/supporting direction expectations for the owned, known, available canonical profiles f01–f08 (with f12 as an edition alias). Each returned proposal counts once if at least one selected canonical profile has a primary cue for the requested vibe. This cue diagnostic does not apply request-specific venue, strength or exclusion filters; the raw-model acceptance test checks those separately. The original rubric was frozen before implementation; a disclosed correction below adds two omitted cozy memberships. These are heuristic profile cues, not measurements of a blend's smell or evidence that the pair works. Note membership and eligibility are separate: wishlist f09 and unavailable f11 also have note cues, but cannot be recommended; neither changes these thematic totals.

| Requested vibe / case | Qwen proposals with a primary cue | 6.1 Sol reference proposals with a primary cue |
| --- | --- | --- |
| Happy / clean, l01 | 1/3 | 3/3 |
| Tired / fresh, l02 | 3/3 | 3/3 |
| Sad / cozy, l03 | 2/3 | 3/3 |
| Calm / clean, l04 | 1/1 | 3/3 |
| Confident / mysterious, l05 | 0/3 | 3/3 |
| Romantic, l06 | 2/3 | 2/3 |
| Warm, l07 | 1/3 | 3/3 |
| Bold, l08 | 0/1 | 3/3 |
| Fresh, l09 | 3/3 | 2/3 |
| Mysterious, l10 | 2/3 | 3/3 |
| **Total** | **15/26** | **28/30** |

Only 4/26 Qwen proposals and 14/30 Sol proposals had primary cues in both selected profiles. Supporting-only proposals are not counted as primary matches. Duplicate bottles count as the same fragrance edition. The four structural/safety-control cases are outside this thematic audit; they remain in the original raw-model acceptance test. Cue matching here does not excuse invalid selections, unsupported claims, contradictory messages or unsafe recipes.

The reference is a blind **gpt-6.1-sol session response**, not a new OpenAI API call or an API latency comparison. The Qwen outputs are the previously recorded local **qwen3-vl:2b-instruct** run. This says nothing about an untested hosted/larger Qwen model.

## What changed in the application

FragOut interprets clothing with a model or typed-input rules, then selects bottles through its grounded catalog/wardrobe engine. Free-text model recipes are not promoted into production recommendations. Engine **1.4.0** improves that actual selection path:

- Recognize missing cues such as Cetalox and ambrette for clean profiles; salt for fresh; honey, chestnut and cashmeran for cozy; tobacco and clove for darker/expressive profiles.
- Use both personal notes and attached sourced catalog notes. A known direct primary note outranks a weaker supporting note or a declared family. Bottle names, brands and memos cannot manufacture matching ingredients.
- Apply explicit vibe alignment before favorites, mood, climate, source bonus and outfit styling. Those factors remain secondary within an alignment group. With no explicit vibe, the previous default sorting and explanations are preserved.
- Rank the whole pair: primary cues count three, supporting/family cues one. Thus two primary anchors outrank one primary plus one supporting anchor, which outranks one primary anchor, which outranks two supporting anchors. This is a product ranking rule, not a learned probability.
- Explain the selected profiles' actual cue strings. A supporting family is labeled a profile. A missing cue does not gain a claimed vibe match. Experimental pairs remain explicitly experimental; source-backed reasons, links and evidence tiers are preserved.
- Reapply the same comparator after outfit styling and when gathering search candidates. A later numeric-score sort cannot quietly undo the user's explicit direction.
- Consider all eligible bottle candidates before applying pair constraints. The old 100-bottle cutoff could lose the only legal pair in a large collection. Retain only the requested top results; outfit scoring happens before this bounded selection. Approved-pair records and bottle identity/dupe lookups are indexed or cached per request.

Ownership, availability, unknown-profile/strength, excluded notes/IDs/pairs, venue, sensitivity and evidence-mode eligibility still run first. No provider call, credential, paid switch, photo-retention rule, database schema or client payload was added. Internal numeric scores are secondary factors within alignment groups, not globally descending match probabilities. The current clients do not display those ranking numbers. Mood-only matching retains its established rules and reason precedence. Default ranking compatibility excludes the deliberate repair of missing legal pairs in collections above the old cutoff.

These mappings are judgment calls, informed by supplied notes and official descriptions. For example, [Juliette Has A Gun](https://www.juliettehasagun.com/en/collections/not-a-collection/products/not-a-perfume-parfum) describes Cetalox in a clean/fresh scent, [Jo Malone](https://www.jomalone.com/wood-sage-sea-salt) describes Wood Sage & Sea Salt as fresh and woody, and [Maison Margiela](https://www.maisonmargiela-fragrances.us/fragrances/replica-eau-de-toilette/replica-by-the-fireplace/MM005.html) connects chestnut and smoky woods with cozy winter evenings. This is not a chemical ingredient/allergen statement or a universal mapping from notes to emotions. A gentle Cetalox profile is only supporting evidence for cozy/romantic, not a floral or gourmand ingredient.

## Before and after

The [original before artifact](evaluations/2026-11-24-vibes-before.json) was captured against engine 1.3.0 at base commit fa1b7ce3b9b1a7e2fa904daa4fad986525a432c4, before implementation. The [original after artifact](evaluations/2026-11-24-vibes-after.json) records engine 1.4.0. Both are retained unchanged. Both use the prior experiment's controlled public collection, neutral personal preferences and supplied profile facts; these are not private user records.

**Rubric correction, November 24:** l03 incorrectly omitted f07's supplied **Vanilla** from primary cozy cues and f01's **Ambrette** from supporting cozy cues (also covering its duplicate edition f12). Counting by supplied notes requires both. The [corrected before artifact](evaluations/2026-11-24-vibes-before-corrected.json) reclassifies the already-recorded selections, without reranking, changing scores/reasons or rerunning models. The [corrected after artifact](evaluations/2026-11-24-vibes-after-corrected.json) uses the same corrected expectations. The initial 7/10 baseline is superseded by **8/10**. Qwen's two-primary count rises from 3/26 to 4/26; the 15/26 versus 28/30 at-least-one totals do not change, because the affected Qwen pair already included another primary cue. Independent review cross-checked all ten canonical-profile sets and found no other omissions. Expectations remain explicit and separate from the production matcher; the annotation correction is not a new raw-model result.

| Fixed-profile check | Before | After |
| --- | --- | --- |
| Best available direction leads, ordinary backend | 8/10 | 10/10 |
| Best available direction leads after outfit styling | 8/10 | 10/10 |

The measured improvements are mysterious (a generic supporting wood becomes a tobacco anchor) and romantic (an unmatched fresh anchor becomes a honey/peach profile). The cozy choice also changes, but both old and new leaders already have two primary cues under the corrected rubric; it is not counted as an improvement. These are **backend ranking results**, not improved raw Qwen generations. The input-order check compares fragrance editions, so a second bottle of the same release is not miscounted as a different recipe. The available best direction can be weaker in restrictive cases; 10/10 does not mean all requests have two primary anchors.

Reproduce against the current source with a new output filename:

```powershell
node scripts/correct-vibe-audit.mjs docs/evaluations/2026-11-24-vibes-before.json corrected-before.json
node --experimental-strip-types scripts/check-vibe-grounding.mjs verify audit.json corrected-before.json
```

Both scripts refuse to overwrite outputs. The audit verifies expectations and available direction maxima against the corrected baseline, checks the top pair before/after outfit reranking, and checks choices after reversing collection order. An empty candidate regression cannot pass as a trivial best match. Protected Quality gates use the corrected baseline alongside mood/vibe HTTP journeys. The dedicated correction script only accepts the original l03 rubric and records the source artifact hash and reason; three regression tests preserve old choices/rows and duplicate-edition membership. Do not silently tune raw outputs or labels to make a future regression disappear; retain original artifacts and disclose any justified annotation correction.

## Verification and release status

Application-release source checks completed: **346/346 unit tests**, including **20 new vibe regressions and one request-scope/source regression**, root TypeScript, mobile lint and mobile TypeScript. The follow-up rubric correction adds three audit regressions; **349/349 tests** and root TypeScript pass. Its protected check record is attached to [PR 20](https://github.com/RoUchiha/FragOut/pull/20). The new regressions failed before their corresponding fixes. A frozen default demo comparison confirms identical HTTP-shaped solo/pair/casual-outfit outputs when no intent is selected. Root/mobile dependency audits report zero vulnerabilities.

Independent read-only review passed 74 focused tests and compared 120 synthetic no-vibe wardrobes against the base implementation, plus 120 adjusted top-k results against full enumeration and stable sorting. The reference cache matched the base for 26 source pairs in both directions, 11 dupe substitutions and 219 named lookups. Review caught and prompted fixes for a test using an unsupported API mode, unintended mood-only changes, an overly broad cue label, premature pair truncation and a future empty-output audit loophole; no Critical/Important finding remained. An informal local synthetic run retained three results from 500 profiles / 124,750 possible pairs in 365 ms. It is not a provider latency benchmark or a load-capacity guarantee; enumeration is still quadratic in collection size, with retained results bounded to the requested limit.

Final web and Android/iOS JavaScript/Hermes exports passed. The production web build passed publication checks (11 traces / 248 public assets, no private database/key/environment/source-map files) and isolated API/OCR dependency loading. Trusted private HTTPS passed 30 operational, 20 web, 17 mobile/API and 133 discovery assertions. The final loopback API run passed nine mood/vibe groups, including conflicting favorite/mood versus cozy and subsequent outfit reranking; its disposable database contains zero users afterward. The isolated synthetic privacy/session lab passed 173 assertions across 12 groups, without external provider calls or personal photos.

Known-credential checks found zero exact/encoded matches in scanned local text and referenced public assets. The existing database/vault variables remain Sensitive and Production-only; the private test has neither secret. All 78 local file links in the changed documentation resolve, and staged Gitleaks is clean. These checks are evidence of specific protections, not a claim that software is unhackable.

Protected [PR 19](https://github.com/RoUchiha/FragOut/pull/19) merged at **2026-11-24 19:46:47 UTC** as **458a11124b7d786e435da81dee32acfb9e4bb534**, with the same tree as reviewed head **0d85e4e8341957b63d871f219d41253b36a8acc0**. Both exact-head Quality runs passed: [branch](https://github.com/RoUchiha/FragOut/actions/runs/45473010980) and [PR](https://github.com/RoUchiha/FragOut/actions/runs/45473022532). No main protection was bypassed.

[Merged-main Quality](https://github.com/RoUchiha/FragOut/actions/runs/45473817916) passed. Vercel deployment **dpl_FBr2eZRkG96z6HyGhovUkFFPxrYy** reached READY for the merged commit. At **2026-11-24 19:50 UTC**, [the live app](https://fragout-wardrobe.vercel.app/mobile) reported revision **458a11124b7d**, engine **1.4.0**, healthy liveness/readiness, mobile page 200 and **paid AI off**. Anonymous state/export/looks returned 401 with no-store; private file paths returned 404. The postrelease known-credential/scope audit remained clean. These production checks were read-only; authenticated recommendation journeys used isolated local/private databases.

Exported iOS/Android JavaScript bundles alone do not establish a signed phone build or TestFlight availability. Later documentation-only releases can advance the public revision without changing engine 1.4.0; use the live health endpoint for the exact current SHA.

Remaining limits: this is a small fixed-profile heuristic audit, not a blinded human wear study, a natural-selfie acceptance test or a benchmark of a hosted Qwen model. It improves the app's grounded choices without training or certifying raw Qwen. Ambiguous or missing profiles still require honest fallback/abstention; blend compatibility retains its existing evidence label.
