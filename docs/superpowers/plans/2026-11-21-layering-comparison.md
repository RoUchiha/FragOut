# Direct layering model comparison

Execute inline; the user asked both existing models for layering combinations across scenarios. Reuse local Qwen3-VL 2B and a blind gpt-6.1-sol session reference. This is an offline experiment, not a new production recommendation provider.

## Fixed design

- Fourteen unique requests cover happy/clean work, tired/fresh weekend, sad/cozy home, calm/low-scent, confident/mysterious party, romantic date, warm evening, bold party, avoided notes, a rejected pair, fragrance-free, insufficient eligible bottles, evidence-only without evidence, and hostile request text. Repeat two Qwen requests separately to measure local stability.
- Both models receive identical instructions, JSON schema and text with a synthetic collection of real catalog editions. Notes come only from the bundled snapshot. Strength/availability/ownership are explicitly fictional observations for the experiment, not universal performance claims. Include wishlist, unknown-profile, empty and duplicate-edition controls. No private user collection is read.
- Freeze input fingerprints, catalog snapshot and exhaustive eligible pair sets before inference. Give the reference only the input manifest, never eligible sets, Qwen outputs, scores or expected pair preferences. No preferred pair is declared gold: scent compatibility is subjective.
- Ask for up to three ranked, distinct pairs with one supplied note per side, a short experimental rationale and no invented evidence, performance or health claims. Missing/unsupported citations and invalid pairs count as failures; do not silently filter them to inflate agreement.
- Local inference: same installed weights, temperature 0, num_predict 700, keep_alive 0; use num_ctx 4096 for this explicit text-card experiment. Capture exact digest/server version, raw response, timing/token counts and input hash. Hosted 27B, paid routing and OpenAI API are not used.
- Primary similarity: unordered exact-edition pair overlap at three, normalized by min(3, eligible pair count), averaged over unique positive cases with MORE than three eligible pairs. Exclude forced/saturated controls and repeats from that mean. Also report top-one agreement and any shared pair. Neither empty agreement nor duplicate pairs earn credit.
- Predeclared criterion for saying the raw proposals are sufficiently similar on this corpus: mean overlap >= 2/3, at least one shared pair in >= 75% of discretionary cases, 100% schema/ownership/venue/exclusion/unique-edition/available-profile/note-citation compliance, full requested coverage, and correct abstention on every zero-eligible-pair control. Report subjective rationale differences and unsupported-claim audit separately. Do not lower criteria after outcomes.
- Agreement does not prove a combination smells good or that either model is a factual authority. A missing note in this limited snapshot means unsupported by the supplied input, not necessarily false in the real fragrance. Production keeps deterministic, source-grounded layering behavior unless a separate authorized implementation is justified.
- Quantity clarification before content review: the prompt says **up to three**, so fewer pairs can satisfy the prompt's safety/schema rules. The predeclared three-slot completeness/overlap criterion is a conservative comparison target, not an instruction violation. Report returned-set Jaccard separately so an identical single returned pair is visibly distinguished from unfilled comparison slots. This secondary diagnostic does not change the fixed acceptance thresholds or model inputs.
- No personal data/images, production writes, credentials, provider activation, paid calls or purchases. Save synthetic run artifacts outside Git; commit sanitized outputs/report and maintained context.

## Work

- [x] Add focused red/green scoring tests: variant aliases, invalid pair constraints, note association, empty controls, duplicates/coverage and similarity denominator.
- [x] Prepare fixed catalog-backed inputs and independent valid-pair oracle; record hashes before models run.
- [x] Obtain actual local Qwen and blind 6.1 Sol proposals; preserve failures and two Qwen repeats.
- [x] Score, manually audit factual claims and publish a comparison with actual examples and limitations.
- [ ] Update PROJECT_CONTEXT.md, run appropriate checks, obtain read-only review and protected CI before integrating the report/tools. No application behavior or native release change is planned.

Outcome: raw similarity criterion failed (12.5% mean three-slot overlap across eight discretionary cases, no same first pair; Qwen violates three abstention controls). Comma-list diagnostics were added after inspection solely to distinguish supplied-note formatting from unsupported ingredients; they do not relax the original criterion or alter model prompts/outputs. All 14 cases and both repeats were preserved without prompt tuning or reruns for a better score. Nine focused tests and the full 321-test suite plus TypeScript passed. See the direct report for the up-to-three quantity caveat and the distinction from prior deterministic app ranking.
