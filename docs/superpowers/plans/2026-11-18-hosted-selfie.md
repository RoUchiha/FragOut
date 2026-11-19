# Hosted selfie analysis and activation plan

> Execute inline using executing-plans; obtain one fresh code review before merge.

**Goal:** Activate approved production/recovery credentials and make the default Qwen photo flow work online with explicit consent, conservative output and private image handling.

**Architecture:** Preserve local Qwen for the separate staging app. Production selects a fixed Vercel AI Gateway Qwen vision model using deployment OIDC rather than a new long-lived provider key. Require per-request zero-data-retention and no-training routing through verified providers; fail closed on unsupported configuration, missing credentials or quota. The owner has delegated implementation choices; spending remains subject to the pending prepaid-budget decision.

**Choice:** Managed Qwen3.8 27B (`alibaba/qwen3.8-27b`) supports native vision and structured output. Wafer and Parasail are currently listed as ZDR/no-training endpoints. A self-hosted robust model would require GPU hosting and more maintenance. The free local model remains available for local testing; a free cloud provider would need separate credentials and retention verification.

**Constraints:** No production/test credential sharing; fixed outbound destinations; no secret values in client/status/logs; no account identity or collection sent to vision; resize and strip photo metadata; no saved image without existing archive consent; typed outfit matching stays offline. No spending until approved. Do not represent tested controls as unhackability.

- [x] Store approved production-only secrets; activate reader; verify local/off-site backup and encrypted escrow; verify main-only backup job.
- [ ] Add fail-first provider tests for hosted routing, privacy filters, missing auth, output validation and failures without fallback.
- [ ] Add public Qwen runtime metadata and bind photo consent to model/policy; enforce consent and daily hosted-use limits on the server.
- [ ] Update photo-send disclosures and settings for hosted/default Qwen in mobile/web. Verify consent/cancel/stale-session paths with regressions.
- [ ] Run root suite/types, mobile lint/types and platform exports; build and audit isolated artifact. Verify production credential scopes and public asset/API exposure using exact-value comparisons without displaying values.
- [ ] Fresh read-only review, required Linux CI, protected merge/deploy, live disposable-user journeys and synthetic hosted-photo smoke when budget permits. Verify default photos are not in DB or backups. Record exact remaining limitations.

**Ruling:** The user's explicit approval authorizes the three previously named credential destinations. The separate prepaid model-budget question does not pause those approved operations. No other existing project is modified.
