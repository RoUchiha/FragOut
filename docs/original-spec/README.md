# FragOut — Codex-ready product specifications

**Status:** Planning baseline, 2026-11-05. No application code is implemented.

FragOut is a mobile-first fragrance wardrobe and evidence-aware recommendation system. It helps users identify and organize bottles they own, choose a fragrance for their present context, and discover tested or explicitly experimental layering combinations. All recommendations must come from a canonical wardrobe, source-backed data, and a transparent ranking policy—not an LLM's unsupported recollections.

## Read this first

1. [`GOALS.md`](GOALS.md): goal, MVP boundaries, measurable success.
2. [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md): features, product behavior, user journeys.
3. [`docs/RESEARCH_SPEC.md`](docs/RESEARCH_SPEC.md): fragrance research, source licensing, evidence policy.
4. [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md): normalized entities and database contracts.
5. [`docs/ENGINE_SPEC.md`](docs/ENGINE_SPEC.md): recommendation, context, and layering rules.
6. [`docs/UX_FLOWS.md`](docs/UX_FLOWS.md): screen/interaction specifications.
7. [`docs/QUALITY_EVALS.md`](docs/QUALITY_EVALS.md): tests, safety, acceptance metrics.
8. [`PLANS.md`](PLANS.md): small, gated development phases.
9. [`AGENTS.md`](AGENTS.md): Codex's standing instructions.
10. [`PROMPTS.md`](PROMPTS.md): copy/paste tasks for each phase.

## Suggested implementation

- **Client:** Next.js, React, TypeScript, Tailwind, responsive PWA. Prioritize phone interactions; keep accessible desktop support.
- **Server:** TypeScript API/server routes, PostgreSQL and an ORM (Prisma or Drizzle—choose and document in ADR), scoped authorization.
- **Auth/storage:** established managed auth and private object storage, selected after security/cost evaluation.
- **AI:** server-side vision-enabled model for bottle-photo classification; text generation limited to explanations and research extraction with validation; structured JSON outputs.
- **Research:** queued, traceable ingestion and manual review/approval; no runtime freeform web scraping to answer user requests.
- **Weather:** provider abstraction, local timestamp/time zone, manual city fallback, license fit for intended commercial model.
- **Operations:** seed data, migrations, health checks, request tracing, token/cost budgets, rate limits.

**Why mobile-first web first?** Faster validation of the wardrobe→recommendation→combo loop; camera upload works from mobile browser. Native apps may become a second platform once the recommendation quality is proven.

## First Codex request

Open an empty repository with Codex and paste the **Bootstrap** prompt in [`PROMPTS.md`](PROMPTS.md). It tells Codex to review these files, resolve contradictions, create an implementation plan, and stop before coding until phase 0 scope is accepted.

## Non-negotiables

- Show **Owned**, **Not owned**, and **Wishlist** status accurately.
- Never claim a product photo was identified with certainty absent sufficient evidence; always offer candidate confirmation.
- Keep **Observed/Brand suggested**, **Community reported**, **Dupe-adapted**, and **Experimental** combos visually and technically distinct.
- Do not silently replace a fragrance with a dupe; explain substitution and changed expected result.
- Cite concrete claims and preserve source, date, rights status, and confidence.
- No prohibited scraping or unlicensed reuse of third-party catalogs, photos, videos, or reviews.
- Never recommend an unowned bottle as if it is in the user's wardrobe.
- Ask permission for location/camera, provide city/manual alternatives, and allow user data deletion.
- Each phase finishes with reproducible checks and a human approval gate.

## Design assumptions to revisit

- Default experience is **wear what you own**, not fragrance shopping or social posting.
- The MVP allows users to select a preferred presentation style and to pin/reorder shortcuts.
- Discovery and the public social graph are post-MVP.
- A private personal wardrobe can start as a small curated catalog plus manual entry; completeness grows through licensed/verified ingestion.
