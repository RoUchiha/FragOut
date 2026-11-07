# Mood and vibe implementation plan

> **For agentic workers:** Implement inline with superpowers:executing-plans and test-driven-development; request a focused independent review before handoff. The user has already authorized implementation choices and autonomous building in this chat.

**Goal:** Recommend owned fragrances and pairs for a chosen mood and desired scent vibe, with compact controls across mobile Today, pairing, outfit matching and the desktop companion.

**Architecture:** Shared enumerated choices and a deterministic, bounded scent-profile affinity bonus. Optional request fields travel in the recommendation context and server-owned feedback snapshot. Eligibility/venue/exclusion checks run first. No new model call, photo analysis or provider data is needed.

**Tech Stack:** Existing TypeScript/Next.js, SQLite and Expo 58/React Native app; no new dependencies.

**Spec:** User request in this chat: “frag recs based on mood (happy, tired, sad, etc) and on vibe (user wants to smell clean, mysterious, warm, etc)”. Prior compact UI, owned-only evidence constraints and verified image/session privacy remain binding.

## Design decisions

- Mood: Any, Happy, Tired, Sad, Calm, Stressed, Confident. Vibe: Any, Clean, Mysterious, Warm, Fresh, Cozy, Bold, Romantic. These are independent, optional choices and can be cleared.
- Mood is manually chosen, never inferred from a selfie. Matching is a subjective scent-style preference, with no promise to treat or change emotions.
- Use only the user's known note/family/strength profiles. Mood has a smaller ranking bonus than an explicit vibe. No strength rule, avoided note, unowned/unknown bottle or pair-evidence gate can be overridden.
- Keep current choices in the active account's UI session, reset on account change, and include them in recommendation requests. Explicit wear logs and saved looks can preserve their selected recommendation context. Ordinary account settings are not changed.
- Mobile uses two horizontally scrolling chip rows. Desktop uses two compact selects. Changes invalidate old result requests, including in-flight ones, without discarding reviewed outfit accuracy.
- Alternatives considered: inferred facial mood is inappropriate and unnecessary; an LLM per selection adds cost/data transfer without better grounding. Use the shared deterministic engine instead.

## Review focus

- Every mood/vibe changes ranking where matching profiles exist, while Any reproduces the previous order exactly.
- A restrictive venue or exclusion still produces no forbidden solo/pair regardless of selections.
- Unknown/empty profiles do not gain invented scent traits or mood-treatment claims.
- Updating a choice during a pending recommendation cannot display an old result under new controls.
- Prior account choices/results do not remain visible after account/server change. Existing image retention and archive consent logic must remain intact.

## Tasks

- [x] **1. Shared engine and API.** First add real ranking regressions for all choices, neutral compatibility, vibe priority, hard constraints, pairing evidence and outfit integration. Add route tests for enum validation and context snapshots. Watch them fail, then add `Mood`, `Vibe`, `ScentIntent`, shared choice/matching helpers, optional `WearContext` fields and validated ordinary/outfit request fields. Preserve selections in server-owned feedback/archive context. Run the full suite and typecheck.
  Files: `src/lib/{types,intent,engine,ai-api,private-looks}.ts`, recommendation route, `tests/intent.test.ts`, route/API tests.
- [x] **2. Compact controls.** Add reusable mobile and desktop pickers. Wire Today live picks, occasion requests, pairing and outfit recommendations. Reset account choices and reject stale results after edits; show short matching reasons and logged/archived context. Verify types/lint and actual browser interactions.
  Files: `mobile/{App,src/IntentPicker,src/Outfit,src/Journal,src/SavedLooks}.tsx`, `src/components/{App,Screens,IntentPicker}.tsx`, styles.
- [x] **3. Verification and delivery.** Independently review the change. Run complete regressions, production build/publication guard, mobile typecheck/lint and web/native exports, existing HTTP/security lab plus new request coverage. Test mobile and desktop in the browser, save a screenshot, update docs/source archive, commit and leave the local preview running.

Verification: 111 unit regressions, 7 intent HTTP checks, 173 security assertions and 37 existing HTTP checks passed. Mobile typecheck/lint, production build/publication guard, Expo web and native bundles passed. Browser checks covered live solo picks, explanations, a wear log, evidence mode switching, reviewed outfit controls and stale-match clearing. Independent review found and confirmed fixes for desktop result and sign-out transitions. Test inputs were synthetic.
