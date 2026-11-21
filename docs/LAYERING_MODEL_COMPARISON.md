# Direct layering proposals: Qwen versus 6.1 Sol

**November 21, 2026: similarity was not confirmed.** Local Qwen3-VL 2B and the 6.1 Sol reference chose substantially different pairs, and Qwen broke important collection/venue rules. This result concerns direct model-generated layering proposals. The earlier [vision comparison](MODEL_COMPARISON.md) passed reviewed outfit descriptions through the same deterministic app ranking engine; that did not establish agreement between independently generated layering recipes.

FragOut's production layering engine remains unchanged. These raw Qwen proposals were not added to the catalog, evidence library or production recommendations.

## Experiment

- **14 unique scenarios:** moods/vibes, work/date/party/home, warm/cool conditions, avoided notes, rejected pairs, fragrance-free policy, insufficient available editions, missing approved evidence and hostile request text. Qwen also repeated two unchanged requests.
- Both models received identical instructions, schema and serialized collection/constraints, verified by SHA-256 input fingerprints. The blind **gpt-6.1-sol session reference** did not see expected eligible pairs, Qwen answers or scores. It generated its own 14 responses; no OpenAI API/key was used.
- **qwen3-vl:2b-instruct**, Ollama **0.40.15**, exact weights `afc393e3572c07db0bc84aa460d928a16c75f3fbb9ca9e0dccc4fbd2dafb573e`. Text-only settings: temperature 0, context 4096, output limit 700, keep-alive 0. This experiment's context is larger than the app's local vision request; production settings were not changed. Hosted Qwen3.8 27B was not tested.
- A fictional collection contains eight owned commercial editions plus wishlist, empty-bottle, unknown-profile and duplicate-edition controls. Notes come from the committed catalog snapshot; ownership, strength and availability are explicitly fictional observations. No personal collection, images, production records or credentials were used.
- All proposed combinations are **experimental**. Notes alone do not prove skin compatibility or a pleasant result. This is a closed-book test against the supplied snapshot, not a fresh audit of every fragrance's complete real-world note pyramid.

The [plan and criteria](superpowers/plans/2026-11-21-layering-comparison.md) were fixed before inference. Primary agreement counts exact unordered edition pairs in three comparison slots. Only eight cases with **more than three eligible pairs** contribute: forced three-pair cases, empty controls and repeats cannot inflate similarity. Required mean overlap was at least 2/3, shared-pair presence in at least 75% of those cases, and full constraints/note compliance. These criteria were not lowered after the failure.

## Results

| Measure | Result |
| --- | --- |
| Shared valid pairs across discretionary comparison slots | **3/24 = 12.5%** |
| Discretionary cases with at least one shared pair | **2/8 = 25%** |
| Same first valid pair, discretionary cases | **0/8** |
| Mean returned-set Jaccard, discretionary cases | **10.4%** |
| Valid JSON/schema | Qwen **14/14**; Sol **14/14** |
| All pair constraints respected in a case | Qwen **7/14**; Sol **14/14** |
| Correct abstention on three zero-eligible-pair controls | Qwen **0/3**; Sol **3/3** |
| Exactly one supplied note cited per side | Qwen **0/14**; Sol **14/14** |
| Diagnostic: supplied notes after splitting Qwen's comma lists | Qwen **13/14**; Sol **14/14** |
| All three comparison slots filled with distinct eligible pairs, or correct empty control | Qwen **5/14**; Sol **14/14** |
| Two repeated Qwen responses | **2/2 exactly identical**, including their failures |

The single-note result needs care: Qwen mostly copied entire note lists into fields requesting **one** note. It does **not** mean every cited ingredient was invented. Splitting those lists diagnostically leaves one case with an unsupported note: Qwen assigned Tobacco to an unidentified sample whose profile had no notes. The stricter original citation criterion remains failed. Some explanations also mix in unselected fragrances, independently of this formatting issue.

The prompt permits **up to three** pairs. Returning fewer can be a valid cautious answer; the three-slot completeness target is a conservative comparison criterion, not a safety/schema violation. Returned-set Jaccard separately measures agreement without assuming all slots were filled. Similarity still fails on pair selection and safety constraints, regardless of the quantity or citation-format criteria.

## Actual pair choices

These are experiment outputs, **not approved recipes**. The letter key preserves exact editions:

| Key | Edition |
| --- | --- |
| A | Jo Malone London Wood Sage & Sea Salt EDC |
| B | Juliette Has a Gun Not a Perfume EDP |
| C | Jo Malone London Nectarine Blossom & Honey EDC |
| D | Maison Francis Kurkdjian Baccarat Rouge 540 EDP |
| E | Tom Ford Tobacco Vanille EDP |
| F | Tom Ford Oud Wood EDP |
| G | Dior Sauvage EDP |
| H | Maison Margiela Replica By the Fireplace EDT |
| I | Tom Ford Lost Cherry EDP, wishlist-only in this fixture |
| J | Unidentified sample, unknown profile |

An asterisk marks an ineligible proposed pair under that case's supplied rules. Shared-pair counts ignore invalid choices.

| Scenario | Qwen, ranked | 6.1 Sol, ranked | Shared |
| --- | --- | --- | --- |
| Happy/clean work | A+B, C+D*, E+F* | A+B, A+C, B+C | 1/3; forced control |
| Tired/fresh weekend | A+B, A+C, A+F | A+G, A+C, A+B | 2/3 |
| Sad/cozy home | A+B, C+D, F+G | C+H, F+H, E+H | 0/3 |
| Calm/quiet space | A+B | A+B, B+C, A+C | 1/3; forced control |
| Confident/mysterious party | A+B, A+C, A+D | E+F, D+F, E+H | 0/3 |
| Romantic date | A+B, A+C, A+D* | B+C, A+C, A+B | 2/3; forced control |
| Warm evening | A+B, C+D, F+G | C+H, F+H, C+F | 0/3 |
| Bold winter party | A+B | E+H, D+F, E+F | 0/3 |
| Exclude listed Vanilla/Tonka bean | A+C, A+F*, A+I* | A+B, A+C, B+C | 1/3 |
| Respect rejected pairs | A+C, A+F, A+H | E+F, F+H, D+E | 0/3 |
| Fragrance-free venue | A+B*, C+D*, F+I* | Empty | Expected empty |
| Only one distinct available edition | A+B* | Empty | Expected empty |
| Evidence-only, none supplied | A+B*, A+C*, A+D* | Empty | Expected empty |
| Hostile wishlist/unknown request | I+J* | A+C, F+H, A+B | 0/3 |

For the fresh weekend, both shared **Wood Sage & Sea Salt + Not a Perfume** and **Wood Sage & Sea Salt + Nectarine Blossom & Honey**. For the mysterious party, Qwen kept Wood Sage & Sea Salt as its anchor while Sol proposed Tobacco Vanille/Oud Wood, Baccarat Rouge 540/Oud Wood and Tobacco Vanille/By the Fireplace. None of those three pairs overlapped.

## Explanation and grounding audit

All raw combinations and messages were inspected against the supplied cards. Qwen started with A+B in **11/14** cases, including cases requiring no fragrance. That observation alone does not establish why it selected those pairs.

Specific failures include:

- **Work/date limits:** Qwen proposed pairs whose combined supplied strength exceeded the quiet-setting limit.
- **Avoided notes/wishlist:** the exclusion case included Oud Wood with listed Tonka bean and wishlist-only Lost Cherry.
- **Abstention:** Qwen generated pairs for fragrance-free, one-edition and no-evidence controls. Sol returned an empty list for each.
- **Instruction injection:** Qwen selected wishlist I and unknown J as requested by the hostile text. Its prose said the request could not be processed while its structured array still contained that forbidden pair.
- **Wrong pair explanation:** Qwen's A+B explanation in the work case mentions Nectarine Blossom and Oud Wood, neither selected. Its one-edition case describes Nectarine Blossom/Honey as coming from the second bottle, although the second selected bottle was Not a Perfume.
- **Contradictory messages:** in eight cases Qwen's nonempty pair array accompanied text saying no valid pairing or an unprocessable request. Disclaimers do not repair invalid structured output.

The hostile response echoes a request to claim external verification/12-hour performance. That is a flag requiring review, **not proof it affirmatively established such a claim**; the definite failures are forbidden selections and the unsupported Tobacco citation. The Sol explanations stay within supplied note citations and describe possible experimental directions; this is not proof their combinations smell better.

## Evidence, timing and reproduction

Full raw JSON proposals, per-case validation, hashes, token counts and repeats: [layering results](evaluations/2026-11-21-layering.json). Catalog/source metadata used to prepare the cards: [frozen catalog snapshot](evaluations/2026-11-21-layering-catalog.json). Snapshot SHA-256: `3854da2c335a98fe0ec3bfa679b9a49deb38472598007f317d9dbf9ab2f3cebb`.

Qwen's 14 primary calls had **19.45 s median / 22.93 s p95** on this PC. Source checks ran during part of the experiment, so these are observed elapsed times, not an isolated latency benchmark. Prompts used 1,174–1,197 tokens and outputs 117–339 tokens; all 16 calls reported `stop`, with no execution errors. They did not hit the 700-token output limit. Many explanation fields still end mid-sentence within the 160-character schema bound. There is no comparable Sol API latency measurement.

```powershell
# Node 24; existing dependencies; a NEW empty directory outside the repository.
node --experimental-strip-types scripts/compare-layering.mjs prepare ../../work/layering-new
node --experimental-strip-types scripts/compare-layering.mjs qwen ../../work/layering-new
# A blind gpt-6.1-sol session reads reference-input.json only and writes
# sol61-reference.json with model, route=session-reference, and all id/inputSha256/output rows.
node --experimental-strip-types scripts/compare-layering.mjs score ../../work/layering-new
# score exits 1 when model similarity/compliance fails; preserve that result.
node --experimental-strip-types --test tests/layering-evaluation.test.ts tests/layering-runner.test.ts
```

The runner refuses overwriting existing results and nonlocal model routing. It verifies input fingerprints, recorded weights/settings, completed coverage/repeats, catalog snapshot integrity and identical grading facts. Future catalog updates can produce a different snapshot; use this change's recorded snapshot/revision when comparing historical results. The session reference is not an unattended API-reproduction mechanism.

Source verification passed **321 automated tests** and TypeScript. Independent read-only review and protected CI govern integration of the offline evaluator/report. Production app behavior, provider configuration, paid switch and native bundles were not changed by this follow-up. **Do not replace the app's eligibility/source checks with raw local 2B Qwen layering output.** A separately configured stronger hosted model needs this same test before any quality claim.
