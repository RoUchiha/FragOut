# Copy/paste Codex task prompts

Use these prompts in a repository containing the FragOut spec pack. Codex should run one phase per approval, not start with a huge multi-phase code dump.

## 0. Bootstrap — first prompt

```text
You are the principal engineer and research architect for FragOut, a mobile-first,
evidence-aware fragrance wardrobe and recommendation app.

First read AGENTS.md, GOALS.md, PLANS.md, README.md, and every file in docs/.
Do not implement app features yet.

Deliver:
1. A traceability matrix from requirements to proposed API/domain components/tests.
2. An architecture decision report (Next.js + TypeScript/PostgreSQL baseline, evaluate
   storage, authentication, weather, vision, search, background research, cost).
3. A source data rights/feasibility matrix. Do not assume Fragrantica or Reddit
   crawling is permitted. Identify practical licensed/brand/manual ingestion.
4. A phase-0 implementation plan decomposed into independently testable slices,
   with explicit acceptance criteria and commands.
5. Unresolved material questions, specific defaults for noncritical ones,
   and realistic bottlenecks. Note research facts vs assumptions.

Keep all work in docs/planning outputs. Do not run paid research or write
application code, deploy, connect external services, or modify remote state.
Stop after delivering the plan for approval.
```

## 1. Foundation / catalog phase

```text
Implement only the next approved slice of phase 1 from PLANS.md. Read all
relevant specs and AGENTS.md. Build a working end-to-end private fragrance
catalog + Owned wardrobe flow with exact flanker/concentration identity.
Use approved/manual seed data only. Write tests for authorization, variants,
manual fallback and source rights. Run and report actual test results.
Stop at the slice boundary; do not begin photo AI or recommendations.
```

## 2. Bottle image identification phase

```text
Implement phase 2 as a thin working vertical slice: private phone photo upload,
server vision interpretation, matching to canonical catalog, top-three candidate
choices and required user confirmation. Must support 'none of these', ambiguous
bottles, same-looking flankers, and photo deletion. No auto-add without consent.
Instrument accuracy/cost, create 100 labeled fixtures or document why target
is not yet obtainable, mock APIs in tests, measure results, and stop for review.
```

## 3. Context recommendations phase

```text
Implement phase 3 only. Home must contain fixed Recommend and Combo controls
and configurable Gym/Date/Work/Party/Errands/user-defined shortcut tiles.
Build context resolver and solo ranking over Owned bottles with weather, local
time, season, venue projection rules and manual fallback. Explanations must be
traceable, scoring deterministic and hard exclusions mandatory. Prove ≥30
fixtures and browser flow. Combo may remain a clearly marked upcoming feature
until phase 4, but must not masquerade as working.
```

## 4. Layering engine phase

```text
Implement phase 4 only. Combo asks for occasion after current/future context;
rank exactly two Owned fragrances. Add evidence source registry, tier logic,
verified exact pairs, single reports only if opted in, documented dupe
relationships, clearly downgraded dupe-adapted pair hypotheses, and optional
experimental pair generation. Include contradictory observations and context.
Never infer exact pair proof through a dupe. Cite source URLs for documented
recipes and enforce source permissions. Test no-evidence and license edge cases.
```

## R. Fragrance research batch prompt

```text
Act as a fragrance research editor, not a generic copywriter. Perform ONE
bounded research batch [INSERT: 25 exact variants / 20 dupe edges / 15 layering
pairs / one note-family topic] under docs/RESEARCH_SPEC.md.

First check each provider's current terms and rights for the planned data use.
Use only permitted access and preserve source URLs, dates, variant specificity,
source independency, direct vs hearsay reporting, and conflicting evidence.
Do not crawl Fragrantica or use unofficial APIs. Do not assume public Reddit
posts are licensed for bulk reproduction. Link or abstract claims only where
permitted and have a human review gate before publication.

Deliver machine-readable structured candidates; field-level citations; a
human-readable comparison of evidence, contradictions, exceptions and biases;
a rights matrix; rejected/unknown claims; and schema validation results.
Never invent note pyramids, community consensus, longevity numbers, or sources.
Mark hypotheses and missing evidence explicitly. Stop before publish.
```

## V. Pre-release independent audit

```text
Perform a read-only adversarial QA review against docs/QUALITY_EVALS.md and
GOALS.md. Verify owned-only recommendations, exact variant identities,
evidence-tier integrity, dupe substitution semantics, licensing, privacy,
weather overrides, venue etiquette and account isolation. Identify gaps with
reproduction steps, severity and likely root cause. Do not claim tests ran
unless they actually ran. Propose a small remediation plan, then stop.
```
