# Free hosted vision and paid switch

Execute inline with test-driven-development and a fresh final code review.

**Goal:** Use Groq Free Qwen3.8 27B vision in production, keeping paid AI available behind an operator-only switch that defaults off. Preserve local Qwen in staging and all existing image/session protections.

**Design decision:** Groq documents free-tier access, image/JSON support and ZDR for all accounts. A dedicated Free account/key without a payment method is required; an operator must confirm Free status and enable ZDR in the provider's account controls. The adapter fails closed until both attestations and the key exist. Account settings cannot be independently verified through the documented inference API. Browser automation could not verify its URL, so sign-in/key creation needs the user's account handoff.

**Paid switch:** Only an exact server `FRAGOUT_PAID_AI_ENABLED=true` may select the existing paid Gateway route. The default auto backend uses Groq when this flag is absent or false. Configuration stays in the production-only Vercel operator boundary; normal app users cannot turn it on. A provided operator command updates the flag and redeploys the reviewed source. Free failures never invoke paid inference. Existing user-connected API choices remain separate, explicit choices.

- [x] Fail-first tests for free destination/auth/privacy readiness, quotas without paid fallback, and paid off/on behavior.
- [x] Add Groq transport, fixed model, generic errors and provider connection test; preserve current consent, metadata stripping, memory-only default images and late authorization checks.
- [x] Update destination/cost disclosures and settings; add protected local Free-key setup and operator paid-toggle commands with no secrets in arguments/files/output.
- [ ] Run source/mobile checks, exports, production artifact audit and secret scan; final review and required Linux CI.
- [ ] Deploy free configuration with paid off, verify public/core and switch boundaries. If credentials are provided, verify actual free synthetic-photo processing and absence of image records. Otherwise report the exact account setup remaining without claiming live inference success.

No purchases, billing upgrades, privacy relaxation, public tunnels or automatic paid fallback are authorized by this task.
