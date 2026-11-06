# FragOut — gated development roadmap

Codex should execute ONE phase at a time, updating a phase checklist and showing working proof. Baseline spec version: v0.1. Each gate requires human approval. Each phase should be split into PR-sized vertical slices; this file is roadmap rather than license for one massive run.

## Phase 0 — source feasibility, architecture, and quality harness
**Build:** repository/scaffold, ADRs, chosen auth/storage/weather model, source-permission matrix, CI, environment sample, sample fixtures, unit/test framework and accessibility baseline. Research a commercially viable content strategy first; verify supplier licenses. Define supported data licensing states, attribution, deletion policy, cost ceilings, and core metrics. No production scraping.
**Pass:** `README`, `AGENTS`, specs linked; environment works; CI lint/typecheck/test; data-source feasibility documented; disallowed sources excluded; manual seed pathway viable.
**Stop:** approve constraints, integrations, and initial evidence source policy before phase 1.

## Phase 1 — canonical catalog and private wardrobe (first useful slice)
**Build:** DB schema/migrations, sample curated catalog of ~50 diverse fragrances (or user-imported manual-only fallback), auth/RLS or equivalent owner-scoped API, catalog search/matching, add/edit/delete owned bottles, variant selector, labels/favorites, empty states. Versioned source records.
**Pass:** full text add/edit/delete works; similarly named EDT/EDP/flankers do not collide; no cross-user access; empty catalog uses manual entry without inventing facts; migration/seed integration tests.
**Stop:** demo two independent users and identity variant edge cases.

## Phase 2 — AI-assisted bottle capture
**Build:** phone camera/gallery and optional name OCR, server vision candidate generation, deterministic canonical candidate re-rank, top 3 choices, photo confirmation, manual escape hatch, private storage and deletion, rate limits and upload validation.
**Pass:** clear/blurred/partial/duplicate bottle test suite; never silently commits a guess; no cross-account photo leak; success paths and failures documented with measured accuracy and cost.
**Stop:** approve accuracy tradeoff, abstention policy, and spend.

## Phase 3 — contextual solo fragrance recommendation
**Build:** weather/time/location provider with manual fallback, occasion profiles, preference setup, normalized fit features, explainable scoring, hard exclusions, fixed and custom home shortcuts, top 3 candidates, feedback, caching and observability.
**Pass:** 30+ fixture scenarios including heat, winter, AC office, gym, long commute, late-night date, rainy day, location denial; 100% owned-only responses; reasons trace to features; user preferences impact rank deterministically.
**Stop:** reviewer signs off on fit and UX in mobile browser.

## Phase 4 — community evidence and layering engine
**Build:** legal/approved research ingestion queue, source metadata/citation renderer, curated direct layering combo records, independent-evidence check, compatibility constraints, dupe edges with confidence, exact-owner substitutions, candidate ranking, pairing application guidance, negative experiences and explanations.
**Pass:** direct evidence vs single anecdote vs dupe-adapted vs experimental classification is correct; no unowned or excluded IDs suggested; dupe variant never mislabeled exact; sources visible on every established claim; safe fallback when evidence sparse.
**Stop:** manually review 20 source-grounded pairings and 20 negative/dupe substitution fixtures.

## Phase 5 — research scale and personalization
**Build:** researched batches with review gate and provenance metrics, contributor moderation workflow, wear logs and favorite/dislike feedback learning, model/provider fallback, dashboards for coverage, quality, latency, token costs, and insufficient evidence.
**Pass:** 100+ audited products and documented coverage, no sources without rights status, observable recommendation quality improvement on held-out test set (not simply engagement metric), QA and model regression.
**Stop:** approve content quality and readiness for beta.

## Phase 6 — beta, polish, release readiness
**Build:** robust responsive PWA, onboarding, retention/deletion/export, graceful weather/AI outages, performance, privacy/terms pages, security review, accessibility check, disaster recovery, deployment runbook, analytics opt-in as required.
**Pass:** fully recorded critical flow, security checks, mobile performance benchmarks, launch checklist, legal/license review, explicit deployment approval.

## Independent research tracks (start phase 0, continue throughout)
- `R1` Scent science and vocabulary: families, accords, note taxonomy, concentration, seasons, contextual etiquette; source conflict recording.
- `R2` Catalog and identity: house/line/name/concentration/year/flankers/reformulations; identify source-licensed images and metadata.
- `R3` Clone relationships: claimed vs commonly compared, opening/drydown/performance similarities, directionality and version.
- `R4` Layering: brand recommendations, firsthand community combos, failed combos, environment context, source duplication.
- `R5` Evaluation: gold scenarios, mislabeled identity examples, inconvenient weather inputs, diversity bias, abstention and safety.

Codex must deliver structured records and research reports with citations, not an unsourced encyclopedic blob. Use `PROMPTS.md` for phase kickoff and research batch instructions.
