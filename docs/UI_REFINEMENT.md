# Compact interface — 2026-11-06

Request: condense the app, use text only where needed, and reduce the generic AI-generated look and tone.

Changes:
- Replaced promotional hero copy with the selected fragrance name, variant, profile and three direct actions.
- Removed banners, sidebar slogans, decorative orbit rings, stamps and repeated reassurance text.
- Reduced navigation, headings, card padding, illustration sizes and occasion controls.
- Kept six owned bottles visible in the desktop home grid; the same grid uses two columns on phones.
- Shortened collection, layering, settings, forms and empty-state copy.
- Kept manual-weather, fictional-demo and experimental-pair labels visible.
- Moved pairing explanations, application notes, guide articles, storage details and connection status into native expandable sections.
- Replaced the decorative starburst mark with a simple bottle mark; shortened page metadata.

No database, authentication, recommendation, evidence-tier or preference rules changed.

Verification: strict typecheck passed; existing 25 domain/storage tests passed; production build passed. Browser checks at 1280×800 and 390×844 found no horizontal overflow. The phone pick panel measured 187 pixels high, with the collection beginning at 575 pixels. Gym results, Why, evidence-only empty state, opt-in experimental pair details, and bottle entry were exercised. The desktop navigation control is hidden at the desktop breakpoint. Default browser viewport restored for handoff.

Screenshots: `FragOut-compact-desktop.jpg` and `FragOut-compact-mobile.jpg` beside the source folder.
