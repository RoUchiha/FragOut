# FragOut mobile and outfit matching

User request: make a real mobile app the primary product; capture outfit selfies, type or dictate an outfit, and recommend owned fragrances and/or pairs. Default to a free model, with optional users' own OpenAI/Claude connections. Retain the compact interface.

## Approach

Expo/React Native for iOS and Android, plus the same app's web build for local inspection. Keep the existing Next.js app/API as the companion service. Native camera/gallery capture, secure native session storage, native speech recognition in development/production builds and keyboard dictation fallback in Expo Go. No store submission or paid build service is authorized.

Free default: Qwen3-VL 2B through a local Ollama process on the computer/server, not an on-device phone model and not a promise of unlimited free hosted compute. No paid provider fallback. Optional per-user OpenAI and Claude API keys are encrypted at rest on the backend and never included in app bundles, state/export responses, logs, or URLs. Connecting a key requires HTTPS or a loopback development connection. Photos are processed in memory and not saved to the database. Users see the selected destination before analyzing a photo.

The model extracts clothing only: garments, colors, palette, style and formality. No person identification or demographic/attractiveness inference. User reviews/corrects the description before recommendations. The deterministic engine applies ownership, venue, exclusions and evidence rules first; outfit style only reranks eligible candidates. Pairs stay evidence-only unless the user explicitly includes experiments.

## Work

- [x] Shared outfit/bottle-capture contracts, schema validation, offline text fallback, outfit scoring and hard-invariant tests.
- [x] Encrypted connection storage, fixed-destination provider adapters, bounded uploads, server-owned analysis/snapshot records, native bearer sessions and API integration tests.
- [x] Native app: Today, outfit capture/review/match, collection with scan/manual entry, layering, journal, account and provider connections. Permission errors have fallbacks; physical permission prompts remain unverified.
- [x] Locally served mobile web export linked from the desktop companion; outfit/provider screens and phone build instructions.
- [x] Real free-model text/photo smoke tests; native iOS/Android Hermes exports, web export, strict checks, production/API/browser checks and independent review. Source archive accompanies delivery.

## Validation focus

Cross-account credentials and analyses; no paid fallback; photo/text privacy; secret-free export; only owned results; outfit cannot bypass fragrance-free venues or note exclusions; experimental labels preserved; model output cannot supply fragrance IDs or execute instructions; native auth and local-server reachability; speech-module fallback and permission denial.

Building native JS bundles or a web preview is not APK/IPA production signing or an on-device camera test. Those evidence levels will be reported separately.
