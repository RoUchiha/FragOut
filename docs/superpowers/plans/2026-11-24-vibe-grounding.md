# Vibe-grounded recommendation backend

Execute inline with test-first fixes and a fresh read-only whole-branch review. User asks whether the prior models' broad scent directions were similar and wants the application backend improved.

## Design and boundaries

Production uses model-read outfit facts followed by source-grounded backend selection; raw model layering proposals are not the application decision path. Improve the selection path people actually use. No new provider call, collection disclosure, paid switch, dependency, model-weight change or image retention is needed.

- Ground direction cues in known notes (including sourced catalog notes) and declared families. Never infer ingredients from fragrance names, brand, memo or model rhetoric. Strong direct note cues outrank weaker supporting/family cues.
- Explicit vibe fit is the primary ranking key after eligibility/evidence filters. Mood, preferences, climate, source strength and outfit fit rank within that alignment group. Preserve ordinary numeric scores as secondary ranking factors, not probabilities.
- Evaluate a pair as two profiles: count supported primary anchors before weaker supporting cues. Explain the actual selected notes/families from the selected bottles. Do not change evidence tiers, source URLs or claim verified compatibility.
- Apply the same intent comparator after outfit reranking and when gathering search anchors so later sorting cannot erase explicit user intent. Any/no vibe preserves the previous ranking/scores/reasons.
- Keep ownership, availability, unknown-profile/strength, excluded notes/IDs/pairs, venue, sensitivity and evidence restrictions ahead of vibe. Missing matches fall back honestly without inventing a matching explanation.
- Use existing compact UI and payloads. This is backend hybrid recommendation tuning, not a claim that the local 2B model learned to generate reliable raw recipes.

## Reproduction and verification

- [x] Freeze before-change solo/pair outputs on the existing public collection, with held-out synthetic profiles in regressions. Audit broad vibes of both models' recorded pairs separately from exact pair overlap; call it a transparent heuristic, not an olfactory trial.
- [x] Write failing regressions for Cetalox/ambrette/salt/honey/chestnut/cashmeran/tobacco/clove cues, strong versus generic/family cues, favorites and conflicting mood, true pair explanations, outfit reordering, Any/no-match behavior and all safety/evidence boundaries.
- [x] Implement in src/lib/intent.ts, src/lib/engine.ts and src/lib/outfit.ts; bump engine version. Reuse existing APIs; no new external transport. Review additionally repaired premature pair truncation, bounded result retention, and request-scoped catalog lookup caching in the API/outfit path.
- [x] Compare before/after real backend outputs with fixed direction expectations and reordered collections. Retain the previous raw-model failure report unchanged and clearly distinguish these backend results from model generation quality.
- [x] Run appropriate source/unit/build/publication, private HTTPS/mobile/API and isolated security checks. Update PROJECT_CONTEXT.md and a detailed report; fresh review and exact-head protected CI precede merging/release. PR 19 merged as 458a111 with main CI and production engine 1.4.0 verified at November 24 19:50 UTC; see the report for evidence and limits.

Ruling: use the existing task checkout on build/vibe-grounding because it is clean and no concurrent implementation occurs; preserve the private app until a rebuild requires stopping only its owned server. Existing delegated implementation/release authorization applies; no repeated approval or new account/paid setup is needed.

Follow-up annotation correction: retain the original before/after artifacts. l03 omitted supplied Vanilla (f07) from primary cozy cues and Ambrette (f01/f12) from supporting cues. Reclassify recorded choices with the explicit correction tool; use the corrected **8/10 → 10/10** audit and disclose the superseded 7/10 baseline. Three tests preserve choices, duplicate-edition membership and refusal of unrelated/repeated corrections. No raw model output or production behavior changes.
