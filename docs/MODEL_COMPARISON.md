# Qwen versus 6.1 Sol: November 21, 2026

The guarded FragOut pipeline passed this controlled comparison after fixes. **The raw Qwen model did not match 6.1 Sol's reliability.** Keep OCR grounding, conservative rejection and user confirmation; this result does not justify trusting model-generated fragrance facts or unattended bottle identification.

## What was actually tested

- Local **qwen3-vl:2b-instruct**, Ollama **0.40.15**, CPU inference on the prepared PC. This is the installed model, not the unactivated hosted Qwen3.8 27B route.
- **gpt-6.1-sol** as the user-requested independent session reference. It viewed the same sanitized JPEGs and received the same task instructions, text and JSON schema. This was not an OpenAI API call or an API sampling/latency comparison. No OpenAI key was needed.
- **19 cases:** seven clear/partial outfit illustrations, three unsuitable/adversarial outfit images, five bottle images and four typed descriptions. Three bottle labels were readable; two were incomplete/unlabeled. Two packshots came from existing bundled public catalog assets. Other images were synthetic; no user selfies or production records were used.
- Expected visible facts were written independently before the blind reference. The reference received opaque IDs, never expected answers, Qwen outputs, fixture source or scores. Image and full-input SHA-256 fingerprints enforce identical comparison inputs.
- Typed/dictated input under the Qwen route uses FragOut's offline parser. Those four cases test that parser against the reference, **not Qwen text inference**.

The [fixed acceptance plan](superpowers/plans/2026-11-21-model-comparison.md) was set before results: complete/schema-valid coverage; 100% app abstention on unsuitable images; no unsupported grounded bottle identity; at least 90% readable-label recall, 90% garment F1, 85% color F1 and 90% top-solo agreement; all ownership, venue and evidence boundaries preserved. The thresholds were not lowered.

## Results

| Check | Qwen | 6.1 Sol | Meaning |
| --- | --- | --- | --- |
| Valid output schema, final 19 cases | 19/19 | 19/19 | Four Qwen-route rows are offline parsing. |
| Raw strict abstention on unsuitable outfit images | **1/3** | **3/3** | Qwen emitted nonempty attributes for an empty image and followed text on a poster. |
| Raw readable bottle names, image-only baseline | **0/3** | **3/3** | Correct bottle prompt; before OCR assistance. |
| Raw readable bottle names, same OCR text supplied | **1/3** | **3/3** | Qwen still missed Sauvage and proposed a wrong Chanel name. |
| App abstention on unsuitable outfit images | 3/3 | 3/3 | Clothing filtering and a contradiction guard rejected the tested failures. |
| App readable bottle identity recall | 3/3 | 3/3 | Both use the same actual OCR/catalog grounding boundary. |
| Unsupported bottle identities accepted by app | 0 | 0 | Incomplete and unlabeled cases remain empty; candidates require confirmation. |
| App coarse garment / color F1, seven positive images | 1.00 / 1.00 | 1.00 / 1.00 | Coarse categories, not exact prose or every visual attribute. |
| Top solo agreement, normal wardrobe | 7/7 | Reference | Actual owned-bottle recommendation engine. |
| Top solo agreement, neutral wardrobe | 7/7 | Reference | Same bottles, favorites off, ratings 3, strength 2, balanced climate. |
| Ownership, fragrance-free, gym/avoided-note, pair/evidence boundaries | Pass | Pass | No unowned bottle or fabricated community evidence accepted. |

Machine-readable final output, including individual raw responses and reviewed profiles: [2026-11-21-vision.json](evaluations/2026-11-21-vision.json). The valid pre-assistance bottle baseline is preserved separately in [2026-11-21-standalone-bottles.json](evaluations/2026-11-21-standalone-bottles.json).

The 14 recommendation comparisons are **seven images in two deterministic wardrobe configurations**, not 14 independent photographs. Formally styled clothing may also receive different raw palette/formality descriptions; the app derives those attributes from supported clothing rather than accepting model opinions. Shared deterministic ranking can produce agreement despite different prose.

## Failures found and changes made

1. **Singular dress was dropped.** The original `dresses?` pattern missed `dress`. The parser now recognizes singular/plural dresses; a failing regression reproduced the issue first.
2. **Sweatshirt and jacket wording changed recommendations.** Recognize sweatshirt/hooded-top vocabulary, casual shorts, and explicit jacket lapels. A second wardrobe with ratings/favorites neutralized exposed a tailored-versus-casual mismatch that the normal wardrobe hid. Agreement moved from 6/7 to 7/7 there after the targeted parser fix.
3. **Qwen hallucinated clothing from a text-only poster.** Its summary also said there was no visible clothing. The review boundary now rejects that explicit contradiction and text-only summaries. This is a conservative consistency check, not a general image classifier or universal prompt-injection defense.
4. **Tiny printed connector words were lost by OCR.** An extra threshold pass actually reads the small `DE` on the bundled Bleu de Chanel label. A geometry check supplements a missing one-to-three-letter token only when a high-confidence OCR word appears between adjacent, aligned label lines. Ambiguous, distant, low-confidence and off-column tokens are rejected. No catalog name is used to fill missing letters.
5. **Qwen could not reliably transcribe a new readable label.** Its bottle request now includes up to four bounded OCR readings as explicitly untrusted data. Grounding still requires exact visible brand/name support. Existing known catalog matches can bypass the model. OpenAI/Claude request behavior is unchanged, and the privacy page discloses Qwen's OCR transcript.
6. **Concentration became a fragrance name.** Qwen proposed `EAU DE PARFUM` as the scent name for a brand-only bottle. Generic concentration/format names are rejected even when those words are printed on the label. Independent review extended the regression to formats such as `Body Mist`, `Perfume Oil`, `Pure Perfume` and composite `Eau de Parfum Natural Spray`; real names containing format words remain allowed.

Five hard cases were then run through the actual updated `runVision` path with the real local model/OCR: hooded sweatshirt, adversarial poster, readable fictional label, tiny stacked Chanel label and brand/concentration-only label. All produced the expected reviewed result. [Live processing evidence](evaluations/2026-11-21-live-provider.json) includes outputs and elapsed times, not private image bytes.

## Timing and practical limits

Final local Qwen image calls had **30.30 s median** and **33.21 s p95** model-call wall time across 15 images, on this CPU-only setup. The five actual processing checks took approximately 34.09 s, 34.63 s, 31.31 s, 0.84 s and 29.54 s respectively; Chanel was resolved by OCR before model inference. These are local measurements, not phone/network/hosted latency promises. No comparable reference latency was measured.

This sample is small and partly synthetic. It does not establish statistical equivalence, natural-selfie accuracy, difficult lighting/occlusion coverage, quality in every language, immunity to arbitrary image instructions or acceptable production hosted latency. Repeated inference stability was not measured. **Raw Qwen remains unsuitable as an unchecked source of bottle identities or fragrance facts.** The app's deterministic recommendation and source-evidence boundaries remain essential.

Production Groq metadata was checked during this task: the dedicated Free key and both Free/ZDR confirmation flags were absent. No hosted Qwen3.8 27B request was made. That route needs its own synthetic-photo acceptance and latency measurement after protected configuration. Paid AI remained off; no credits, account upgrade or fallback were activated.

## Method corrections and reproducibility

The first exploratory harness accidentally attached generic outfit user text to bottle tasks. Those five initial results were excluded. Both models reran all five bottles with the real bottle instruction. After adding OCR assistance, both reran those same five with identical OCR-assisted text. The 14 unchanged cases retained their exact original input/image fingerprints. The final corpus is therefore a documented phased run, not a claim of one untouched first attempt.

The scorer initially counted a dress's described skirt as a second garment. It now counts the primary garment in that item, with sweatshirt/hooded top grouped as hoodie. Declared coarse synonyms include shirt subtypes, pants/trousers/jeans, jacket/blazer, suits as jacket plus trousers, shoe subtypes, navy/blue, grey/gray, cream/white and tan/beige. Extra or omitted categories still reduce precision/recall. This correction also improved reference scoring. Raw failures remain in the report.

With Node 24 and the existing dependencies installed:

```powershell
# Choose a NEW, empty directory outside the public repository.
node --experimental-strip-types scripts/compare-vision.mjs prepare ../../work/model-comparison-new
# Start the installed local Ollama model. This command refuses hosted/paid routing.
node --experimental-strip-types scripts/compare-vision.mjs qwen ../../work/model-comparison-new
# Obtain a fresh blind gpt-6.1-sol session reference using reference-input.json only.
# Save sol61-reference.json with model, route=session-reference and cases containing
# id, inputSha256, imageSha256 (images), and output. Never expose expected.json.
node --experimental-strip-types scripts/compare-vision.mjs score ../../work/model-comparison-new
node --experimental-strip-types --test tests/model-evaluation.test.ts
```

Preparation refuses nonempty directories. The runner records model/server versions and, for future fresh runs, the exact installed model digest. Existing outputs require explicit `--resume` and matching recorded weights. It also validates actual current request/image/prompt/schema fingerprints before any inference or reuse, uses the prepared OCR evidence for both model outputs, and refuses passing acceptance when any execution row contains an error. These guards have actual-runner regressions. This historical phased run predates digest recording, so its report does not claim an inference-time digest. The reference session cannot be reproduced by an unattended OpenAI API invocation without separately configuring that API; no API credential is bundled.

Synthetic fixture bytes, temporary image files and operator logs stay outside Git. The committed reports contain sanitized model text, hashes and public packshot identities only. They contain no personal photos, production data, keys or credentials.

## Release verification

The root automated suite passed **312 tests** with zero failures, including the new scoring, actual-runner, parser, OCR geometry/runtime and bottle-provider regressions. Root/mobile types, mobile lint, both dependency audits, web/native exports, production build, publication scan (11 traces/248 public assets) and isolated OCR/API loading passed. Private HTTPS passed 30 operational, 20 web, 17 mobile/API and 133 discovery assertions; an additional real-Qwen authenticated photo run passed all **18 mobile/API checks**, including export, account cleanup and session revocation. The isolated attack lab passed 173 assertions across 12 groups with synthetic inputs and no paid calls. Review prompted the additional format and benchmark guards above; the reviewer then passed 68 focused tests and found no remaining issues.

[PR 16](https://github.com/RoUchiha/FragOut/pull/16) passed both final-head required Quality runs and merged as **905c925**; main Quality also passed. Its Vercel production deployment reached READY. At **08:42 UTC on November 21**, read-only public checks verified the expected revision, health/readiness/mobile/privacy 200, private endpoints 401 and paid AI off. The publication audit found no known credential matches, and seven private paths returned 404. [Public verification](evaluations/2026-11-21-production.json), [redacted publication audit](evaluations/2026-11-21-publication-audit.json), and detailed CI/release evidence are maintained in [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md). No production data was written. Bundle export alone does not establish a signed iOS/Android release, TestFlight upload or physical-device acceptance; hosted model activation remains outstanding.
