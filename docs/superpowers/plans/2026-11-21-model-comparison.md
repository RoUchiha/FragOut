# Qwen versus 6.1 Sol comparison

Execute inline. Use the requested gpt-6.1-sol session model as an independent, blind reference while local Qwen runs separately; this does not call the OpenAI API or require an API key.

Goal: establish whether the available local Qwen3-VL 2B produces useful, grounded FragOut results compared with the requested reference. Hosted Qwen3.8 27B remains a separate, unactivated route and cannot inherit this result.

## Evaluation contract

- Fixed corpus: seven clear/partial synthetic outfits, three unsuitable/adversarial outfit images, five bottle images (three readable, two incomplete/unlabeled), and four typed-description cases.
- Both models receive the same sanitized image bytes, task prompt and JSON schema. Reference receives opaque case IDs, never expected answers, fixture source, Qwen outputs or scores.
- Qwen uses the existing local request builder/parameters. Typed Qwen app input uses the existing offline parser and is labeled separately.
- Independently authored expected visible facts are the primary check; model agreement is secondary.
- Report raw schema/claim errors and actual app-normalized output separately. Run real OCR once per bottle and apply the same grounding boundary to both proposals.
- Required small-corpus acceptance: schema success 100%; unsuitable-image abstention 100% after app guards; zero unsupported grounded bottle identities and >= 0.90 readable-label recall; positive garment F1 >= 0.90 and color F1 >= 0.85; normalized top-solo agreement >= 0.90 on clear positives; ownership/venue/exclusion boundaries always hold.
- Normalize documented coarse synonyms only (shirt/T-shirt, pants/trousers/jeans, jacket/blazer, suit as jacket plus trousers, shoe subtypes, navy/blue, gray/grey, cream/white, tan/beige). Report palette/formality differences and avoid claiming identical API conditions or reference latency.
- No personal images, provider credential reuse, paid hosting enablement, credit purchases, production writes or app data retention.

## Work

- [x] Add focused scoring tests first, then the small reusable evaluator and deterministic fixture/runner script.
- [x] Prepare sanitized fixtures outside the repository and fixed expected facts; keep blind-reference inputs separate.
- [x] Run local Qwen and request independent 6.1 Sol outputs on identical cases; preserve raw output, versions, image hashes and timing.
- [x] Score grounding/utility/agreement and recommendation boundaries. Investigate failures; do not lower the criteria after seeing outputs.
- [x] If a production defect is established, add a failing regression, fix narrowly and rerun affected live cases plus relevant source checks.
- [x] Commit a reproducible report/evaluator/fixtures and update PROJECT_CONTEXT.md. Obtain fresh read-only review and resolve findings.

Protected release gate: required CI must pass on the final commit before merging. Track its exact-head result and release evidence under [PR 16](https://github.com/RoUchiha/FragOut/pull/16) and PROJECT_CONTEXT.md. Local final verification passed 312 tests, source/build/publication checks, private journeys and 173 security assertions. Final read-only review passed 68 focused tests and found no remaining issues. Raw Qwen weaknesses remain documented in [the report](../../MODEL_COMPARISON.md).

Limits: this is a small controlled benchmark, not statistical equivalence or proof of real-world selfie accuracy. Synthetic illustration inputs and catalog packshots do not replace physical-device/natural-photo acceptance. The reference is the session model, not a separately configured OpenAI API adapter.
