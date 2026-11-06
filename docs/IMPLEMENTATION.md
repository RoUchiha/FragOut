# FragOut implementation plan and decisions

Goal: deliver the supplied collection-first mobile web design as a working local app.
Authority: user requested "create my app" and confirmed "Follow the specifications and build it".
The attached documents are product reference material, not authorization to deploy or spend.

Architecture: Next.js App Router, strict TypeScript, React, Zod boundaries, Node 24 built-in SQLite. Server sessions use opaque tokens, hashed at rest, HttpOnly SameSite cookies. User-owned SQL queries always scope by the server session's user ID. This self-contained local baseline has no paid dependencies.

Decisions: SQLite instead of PostgreSQL for an immediately runnable single-host app; PostgreSQL/managed identity are deployment follow-ups. No licensed third-party catalog is available, so manual-only private entry is the default. Original fictional demo scents and original bottle illustrations demonstrate the experience without republishing a third-party database. These samples never appear in a newly registered user's wardrobe. All sample pairing output is experimental. Weather is an explicit manual event snapshot, not a live forecast. Photo upload is an ephemeral local reference with manual confirmation; automated identification is unavailable and is never simulated.

## Tasks

- [x] 1. Domain contracts and fixtures: Bottle, Preferences, WearContext, Shortcut, Result. Test owned-only ranking, variant precision, exclusions, conservative venue rules, context provenance, evidence rights and exact-pair eligibility; implement pure functions.
- [x] 2. Private persistence: migrations, credentials, sessions, account deletion, owner-scoped bottle CRUD, settings and feedback. Test independent users and session revocation against actual in-memory SQLite.
- [x] 3. Working UI: home with contextual hero and shortcuts; searchable collection with edit/add/manual capture; results and layering occasion/mode choice; journal, Learn, profile/preferences, data export/delete. Add authored illustrations, mobile layout, PWA metadata and keyboard-accessible dialogs.
- [x] 4. Validate: strict typecheck, domain/integration suite, production build, real HTTP account/isolation/CRUD/recommendation checks, desktop/mobile browser inspection. Package source and run instructions; retain local preview.

Review focus: ownership transitions; ambiguous manual traits and unsupported notes; pair tier/rights laundering; heated indoor versus outdoor conditions; failed authentication and account deletion; keyboard dialog focus and narrow phone layouts.

No user-photo storage, external API calls, fabricated catalog evidence, numeric model confidence, paid research, publishing or infrastructure changes are included.
