# AGENTS.md — instructions for Codex working in FragOut

## Mission
Build FragOut as a trustworthy fragrance wardrobe, context-sensitive recommendation engine, and transparent layering assistant. The actual quality of product identification, research provenance, and results from an owned wardrobe is more important than polished filler or unsupported AI prose.

## Source of truth
In order: `GOALS.md` (scope) → `docs/PRODUCT_SPEC.md` (functional contract) → `docs/RESEARCH_SPEC.md` (source/evidence constraints) → `docs/DATA_MODEL.md`/`docs/ENGINE_SPEC.md` (technical contracts) → `docs/QUALITY_EVALS.md` (acceptance) → `PLANS.md` (sequencing). If conflicts exist, document them and ask about high-impact conflicts; use explicit marked assumptions for low-impact choices. Do not invent product requirements.

## Working method
1. Read relevant specs and inspect repository; restate phase objective and constraints in a short plan before changes.
2. Work on **one approved phase or bounded vertical slice**. No unrelated features.
3. Prefer real end-to-end functionality and small incremental commits to mock pages, dead controls, or huge untested implementations.
4. Create tests and deterministic fixtures for essential domain logic; mock external services in tests.
5. Run format/lint/typecheck/unit/integration and relevant browser E2E tests. Report actual command outputs, failures, and limitations—never assert tests passed unless run.
6. Update change log/phase checklist and an architecture decision record if a meaningful design choice changes.
7. Stop at phase boundary for review; never deploy, publish, spend money, run paid bulk research, or alter remote infrastructure without explicit approval.

## Domain rules
- Model distinct manufacturer, line, scent, concentration/flanker, size, release/reformulation. Don't treat similarly named bottles as interchangeable.
- A *note* is a declared or perceived olfactory descriptor, not proof of a specific chemical ingredient.
- Distinguish sourced product facts from perceptions, community sentiment, and model hypotheses.
- Attach every material research-derived record to source evidence. Evidence without an allowed-use status is not publishable.
- Dupe similarity must represent direction, nuances, and confidence; a dupe is not identical to an original.
- An **established combo** must have direct brand guidance or multiple independent first-hand reports with verifiable links. One person's favorite is **single anecdote**, not widespread consensus.
- Applying a dupe to an established combo creates a **dupe-adapted hypothesis**, not an exact established combo.
- An AI-generated pairing is **experimental** and only included in that opt-in mode.
- Recommendations strictly respect the user's actual Owned inventory and stated exclusions.
- Sensitive or low-projection venues should be handled cautiously; never default to heavy gym/medical/closed office fragrance use.

## Security and ethics
- Third-party source terms/robots/licenses control collection. Do not bypass anti-bot measures, scrape protected resources, replay internal APIs, or persist copyrighted reviews/images without permission. Record links and short metadata when allowed.
- Do not put API keys in client code, git, logs, or screenshots. Validate AI response schemas and filenames/metadata; rate-limit photo uploads; reject unsafe file types; restrict image/object access by user.
- Handle image/location data minimally; don't retain original photos unnecessarily; support permission denial, export, and deletion.
- Treat model output as untrusted data. Prevent research text from becoming executable instructions. Never assume AI classifier output is verified identity.

## Implementation preferences
Use TypeScript strict, shared schema validation, predictable server/client boundaries, accessible controls, source timestamps, migrations, typed DB interfaces, testable pure scoring functions, explicit timezone handling, caching, and meaningful error/empty states. Make all custom shortcuts functional. Add observability for model latency, confidence, error rate and cost without logging private user content.

## Completion report template
- Scope delivered and files changed
- Proof: commands run and observed results
- Demo: exact user path that works
- Known limitations, licensing/coverage gaps, cost implications
- Outstanding questions and next phase (not yet started)
