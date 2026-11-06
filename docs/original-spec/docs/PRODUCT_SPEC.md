# FragOut product specification v0.1

## What the app solves
Fragrance collectors have many bottles but limited context-aware guidance for what to wear today. Existing note/accord descriptions do not reliably answer whether a particular user's actual bottle is appropriate for a humid commute, quiet office, warm-weather date, crowded gym, or layering experiment. FragOut closes this loop with owned inventory + context + research evidence + feedback.

## User experience principles
- Fast default path: open app → tap a contextual button → see ranked owned fragrances with actionable explanations.
- Never make a user fill out a questionnaire each time. Remember profiles and ask only missing contextual information.
- Visual hierarchy: one primary recommendation, two alternatives, confidence/evidence badge text, concise “Why this works,” and one-tap feedback.
- User controls shortcuts: show/hide/reorder/relabel/customize icon, occasion and environment parameters. Fixed `Recommend` and `Combo` always accessible; system occasion shortcuts can be hidden but restorable.
- Make recommendations based on a **wearing event**, not only present weather (e.g., select future Saturday evening, different venue, indoor climate).
- Normalize user jargon: freshie, blue, gourmand, amber, musky, beast mode, airy, skin scent; show plain-language definitions.

## Functional requirements

### F01 Account / preferences
- Sign in; private wardrobe, favorites, history, custom shortcuts; account deletion/export.
- Optional onboarding: fragrance strength tolerance; scent families or notes liked/disliked; typical venues; temperature units; preferences for adventurous or familiar choices; optional gender presentation preferences without boxing perfumes into gendered rules.
- No location required to use the app; manually set city/temperature/time/season/indoors.

### F02 Wardrobe
- Search by brand, name, nickname/aliases, concentration, flanker, year; fuzzy matching and de-duplication.
- Add by photo from camera/gallery: identify bottle, recognize text, search canonical database, display *up to three* candidates with brand, exact variant, reference image (only if licensed), and confidence. User confirms. For uncertainty ask for bottle front/back or manual label.
- Add manual/custom unknown scents; mark details unknown rather than fabricate.
- Inventory bottle attributes: owned/wishlist/not owned, size, estimated fill, acquired date, price optional, batch/version optional, notes, personal rating, usage and favorite.
- Multiple bottles of same fragrance supported; only Owned bottles are eligible for normal recommendations.

### F03 Dynamic home
- Top contextual panel: city or manually chosen location, temperature feels-like, humidity/rain when available, local time, season, privacy/settings status; clear context override.
- Permanent buttons: `Recommend`, `Combo`.
- Suggested default shortcut tiles: `Gym`, `Date`, `Work`, `Party`, `Errands`.
- Add custom tile (title, icon, intended occasion, indoor/outdoor, duration, strength tolerance, style, recurring venue); reorder, remove, reset defaults.
- Clicking an occasion immediately ranks single fragrances with stored environment; prompts only for missing constraints (e.g. indoor vs outdoor when important).
- `Recommend` uses present context and optional quick occasion selection, but it can return a general day suggestion without one.
- `Combo` gets present context, then asks **occasion** before offering pairs; show only Owned × Owned pairs.

### F04 Contextual recommendation
- Inputs: user/location weather, feels-like, humidity/wind/precipitation when available, local date/time, astronomical/meteorological season policy for hemisphere, optional event time/location, indoor/outdoor, crowd density, venue sensitivity, event duration, formality, user preference, known performance with uncertainty, and wardrobe.
- Output: ranked 1–3 owned fragrances, climate fit and venue-fit explanation, expected style/vibe, *cautious* application suggestion, notes/accord rationale, why other choices didn't win, confidence and source summary.
- Strong/oud/animalic/heavily projecting options are de-emphasized or excluded in settings like gym, small office, shared transportation; user can override with acknowledgement if not a hard user restriction.
- Include “none is a confident fit” state instead of forcing an unsuitable recommendation.

### F05 Layering
- Occasion picker is mandatory for Combo unless already passed from home/shortcut.
- Modes: `Evidence-backed` (default, requires approved direct evidence; if none exists display honest gap), `Include single anecdotes` (explicit opt in), `Explore experimental` (explicit opt in).
- Four possible result labels: `Brand-suggested`, `Community corroborated`, `Dupe-adapted — experimental variation`, `AI-proposed — untested`. A single first-person post is `Single user report`, never corroborated.
- Show pair, reason, base/accent and an optional **starting application order**, environmental appropriateness, projection caution, evidence links, both fragrance variants, and substitution notes.
- Substitution path: original A+B established; user owns clone A′ and B. Evaluate A′ similarity to A across opening/heart/drydown and strength, and whether any independent evidence exists for A′+B. Without direct evidence mark A′+B as **dupe-adapted**, never upgrade to established by inheritance.
- Avoid mixing bottles chemically. All combo guidance means separate on-skin/clothing application where appropriate, not decant-and-mix.
- Let users record success/failure, best spray balance, weather and venue; private feedback does not equal public consensus.

### F06 Learn + research transparency
- Browse fragrance profile: brand, line and variant, official note pyramid when licensed/available, perceived accords if verified, scent character, typical contexts, nuanced performance uncertainty, clones/inspirations, cited claims.
- Learn notes/accords, scent families, note interactions, scent concentration, subjectivity and exposure/sensitivity.
- Show each claim's provenance and last verified date when material; conflicting sources remain visible rather than arbitrarily averaged into certainty.

## Edge cases
Photo shows more than one bottle; a brand uses nearly identical bottles; a flanker differs by only cap/badge; reformulations; counterfeits; decants; local weather API down; no location permission; only one owned fragrance; no source-backed combos; dupe similarity disputed; very limited catalog; night-shift users; different target event city/time zone; fragrance-free venue; sensitivities; no owned scents; strong scent at crowded gym; personal disliked-note hard exclusions.

## Non-functional needs
- Privacy by default; secured access to photos and wardrobe; no secrets client-side.
- Dynamic pages have skeleton/loading/empty/error states; PWA usable on phone.
- Responsive app, keyboard support, readable contrast and accessible labels.
- Latency targets: cached recommendations feel immediate; call network only on stale context; avoid per-tap research crawls. Measured budgets to be set in phase 0.
- Explainability and evidence are first-class, not an optional AI-generated paragraph.

## Explicit future extensions
Travel planner, commute vs destination weather, room/spray cloud etiquette, refill/usage, discovery, wishlist-to-cart, saved combo library, scent calendar, seasonal rotation, shareable cards, crowdsourced recommendations with moderation, optional scent DNA embeddings (after empirical validation).
