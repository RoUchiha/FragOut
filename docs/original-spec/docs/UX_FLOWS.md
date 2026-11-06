# UX flow and screen specifications

## Screens and hierarchy

### 1. Onboarding / permissions
- One sentence value proposition: “Know what to wear from the fragrances you own.”
- Ask to add first fragrance before inviting optional preference setup.
- Optional city/weather and camera permission only when corresponding feature used; provide no-location/manual route.

### 2. Home (primary)
- Header: `FragOut`, avatar/settings, context line (`72°F • Warm • Evening • [City]`) with source/freshness and edit affordance.
- Hero: **Today's Pick** top owned scent, 1–2 line reason, `Why?`, `Another pick`.
- Persistent primary actions: `Recommend`, `Combo`.
- Shortcut grid: `Gym`, `Date`, `Work`, `Party`, `Errands` plus any custom tiles. User can drag to reorder, long-press to edit, toggle defaults, create custom.
- Bottom navigation: `Home`, `Collection`, `Discover/Learn` (can initially be Learn), `Profile`.
- `Recommend` opens ranked list for present circumstances; quick pick future time/occasion if desired.
- Each shortcut can remember default crowd, indoor/outdoor, intensity and event duration; avoid repetitive dialogs.

### 3. Collection
- Search plus filters: house, type, concentration, family, season labels, favorite, own/wishlist.
- Add via text search, camera/photo; separate choice for manual custom entry.
- Grid/list with name, exact concentration/flanker, owned count, optional personal rating, licensed image only.
- Detailed bottle view: identity, documented notes/accords, confidence and sources, performance impressions, source caveats, favorite/edit/delete.

### 4. Capture and identify
- Preview chosen image; user can crop/edit and retake.
- Progress: analyzing → matching catalog → candidate selection.
- Show up to 3 candidates including exact edition/concentration. Highlight visible identifying clues and differences, with confidence band (high/medium/uncertain; internally calibrated score).
- Confirmation required. “None of these” opens manual entry with optional reuse of detected text.
- Multi-bottle image: ask to crop one bottle now; multi-detection planned later.

### 5. Solo result
- Header: occasion and conditions; primary result large and two alternatives.
- Details: `Best for this setting because ...` showing 2–3 grounded reasons; note that season/notes are suggestive, subjective.
- Actions: `Wear this`, `Not my style`, `More like this`, `Change occasion`, `Why this?`.
- Explanations and primary reason data survive an AI service outage.

### 6. Combo flow
- Launch from `Combo`: defaults to present weather/time and asks occasion (`Gym/Date/Work/Party/Errands/Custom`) if none provided; optional choose event time and indoors/outdoors.
- Default `Evidence-backed` results. When none, friendly empty message and explicit controls `Include single reports` or `Explore experimental`.
- Pair card: both exact bottles, evidence tier visibly in text, why it may work, notes/accord contribution, who dominates, starter application order/ratio if supported, caveat, source links.
- If adapted: banner text “Based on documented A+B. You own A′+B; A′ is a reported alternative to A. This exact pairing has not been verified.”
- Actions: `Tried it`, `Loved it`, `Didn't work`, `Save combo`, `See original source`.

### 7. My shortcuts editor
- Tiles reorderable with accessible move up/down alternatives; toggle defaults; create occasion/time/setting templates; always show Recommend and Combo.
- Custom config: label/icon, scenario type, indoor vs outdoor, crowd, formality, duration and intensity; preview before saving.

## Mobile states and design checks
- Always provide empty/error/loading/slow-network states; weather provider unavailable never blocks inventory browse.
- Avoid hover-only controls and tiny tappable targets. Support reduced motion, screen readers, reasonable contrast, and keyboard navigation.
- Expose certainty through words and evidence details, not color alone.
- Maintain global clear return path to Home and collection.
- Use consistent units/timezone and allow edits before a planned future occasion.

## One-minute demo path
Open app → add owned fragrance by text → add second by photo → confirm variant → tap Home `Recommend` → show weather-aware top 3 → tap `Combo` → choose `Date` → show sourced exact pair if in seeded fixture, otherwise clear evidence gap + opt-in experiment → save feedback → customize a shortcut → revisit home and use it.
