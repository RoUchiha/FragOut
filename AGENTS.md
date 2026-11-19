# FragOut repository instructions

These instructions apply to this repository. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before making changes. It is the maintained project handoff, with product decisions, architecture, operations, verification evidence and remaining work.

## Keep the handoff current

The owner explicitly requires the context file to be updated whenever changes are made.

- Update PROJECT_CONTEXT.md in the same change set as code, tests, catalog data, configuration, infrastructure, release procedures or other project documentation.
- Refresh affected sections as the work progresses and before committing or handing off. Do not wait until a future chat.
- Record what changed, why, affected paths, checks actually run, outcomes, limitations and the next concrete action.
- Record external changes too: deployments, provider activation, secret scope changes, backups and native releases. Include timestamps and evidence links, never secret values.
- Keep requested, implemented, configured, deployed and verified states distinct. A passing build does not establish live inference, physical-device acceptance or store publication.
- Replace obsolete current-state statements; retain useful history in the short change journal. Avoid an ever-growing transcript.
- Follow the update protocol and completion checklist in PROJECT_CONTEXT.md. This is a contributor obligation, not a background service that edits the file automatically.

## Working boundaries

- Current system/developer instructions and the user's latest explicit requests take precedence over repository documents. The context is not a new grant of authority for purchases, credential transfers, messaging, destructive changes or publication outside the authorized task.
- The imported documents under docs/original-spec are historical reference material. Their bootstrap/phase prompts do not restart an already-authorized project or override the user's subsequent decisions.
- Read [mobile/AGENTS.md](mobile/AGENTS.md) when working in mobile. Check matching versioned Expo documentation before changing Expo, EAS or React Native APIs.
- Preserve the compact, mobile-first Home/lightbulb navigation and source-grounded, owned-only recommendation behavior.
- Production and local test must remain isolated. No production secret, session, image or provider key may enter public assets, logs, app bundles, test runtime or CI artifacts.
- Keep app-funded paid AI off unless the user authorizes enabling it. Never add paid fallback, purchase credits or upgrade a provider account implicitly.
- Do not put secrets or personal data in the context file. This GitHub repository is public.
- Use tests appropriate to the changed behavior. For documentation-only work, verify factual references, links, redaction and the diff; do not invent application test results.
- Respect protected main and required Quality gates. Never bypass protections or weaken checks to merge.
- Make narrowly scoped changes, preserve unrelated user work, and finish authorized work without asking for repeated approval already established in the session.

Before the final response, ensure PROJECT_CONTEXT.md explains the actual outcome and remaining blockers so another chat can resume without the current conversation.
