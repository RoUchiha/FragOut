# Data model and service contracts (logical schema)

All IDs are UUIDs except provider IDs. Timestamps are timezone-aware UTC; local event time and IANA time zone stored separately. Use normalized tables + relationship keys. Below is a contract, not a premature final SQL migration.

## Canonical domain entities

| Table/entity | Required fields and constraints |
|---|---|
| `houses` | `id`, normalized name, country optional, approved metadata/source |
| `lines` | `id`, `house_id`, name, aliases; optional |
| `fragrance_variants` | `id`, `house_id`, `line_id?`, canonical display name, concentration (`EDT`,`EDP`,`PARFUM`,`ELIXIR`,`OIL`,`OTHER`,`UNKNOWN`), flanker/edition, release year nullable, region/formulation nullable, `status`, primary licensed image ref nullable, provenance; unique composite identity not name alone |
| `fragrance_aliases` | `variant_id`, alias, locale, source; search support; not dupes |
| `notes` | `id`, normalized note name, synonyms, family or classification, definition, editorial validation |
| `variant_notes` | `variant_id`, `note_id`, stage (`TOP`,`HEART`,`BASE`,`UNKNOWN`), declaration type, source claim ID, `status` |
| `accords` and `variant_accords` | normalized accord tags and provenance; distinguish user-perceived vs brand-declared |
| `fragrance_family_memberships` | variant/family/taxonomy/version, strength/confidence, source |
| `performance_observations` | variant, source claim, duration/projection/sillage, context, self-reported vs professional, independence/hash as lawful, numeric uncertainty |
| `dupe_edges` | from (inspired) variant → to (reference) variant, type, original/source attribution, similarity overall/opening/drydown (nullable), differentiators, confidence, reviewer, evidence; directional, many-to-many |
| `layering_combos` | canonical ordered/unordered pair of **exact variant IDs**, application order optional, curated summary, support tier, conditions, negative signal, provenance, status, last reviewed; unique pair identity independent of order unless order materially matters |
| `combo_reports` | exact combo, source claim, firsthand flag, sentiment, context, independent author key if permitted, perceived result, order/ratio, publication date |
| `sources` | URL, publisher, content type, publication/accessed date, author if allowed, rights status, terms record, attribution requirement, allowed extraction fields |
| `claims` | subject type/id, predicate, typed value/JSON, source id, extracted date, rights, verification state, reviewer, conflict group |
| `research_batches` | scope, status, version, counts, reviewer, audit notes |

## User-specific entities

| Table/entity | Required fields and constraints |
|---|---|
| `users`, `profiles` | auth ID; privacy/preferences, language/timezone, explicitly optional gender-related style controls |
| `user_bottles` | `user_id`, `variant_id` nullable for manual custom fragrance, manual name/metadata nullable, ownership enum `OWNED`,`WISHLIST`,`REMOVED`, size/fill/rating/batch, acquired date; multiple bottle support |
| `user_preferences` | liked/disliked notes/families, projection tolerance, sensitivity flag, crowd/venue sensitivity, adventurousness, hard exclusions |
| `user_shortcuts` | `user_id`, icon/title/order/visibility, occasion, default environment preferences, system/default identifier; limits |
| `wear_events` | `user_id`, timestamp/location coarse optional, variant IDs or combo, occasion, satisfaction, longevity perception, projection feedback |
| `recommendation_requests` | user ID, time, privacy-preserving context snapshot, selected occasion, engine version, user inventory version; retention policy |
| `recommendation_results` | request ID, variant IDs, scores/reason codes, eligible vs filtered, output tier, claim links, user action; sanitized logging |
| `upload_sessions` | user ID, private media key, analyzed state, candidate IDs/confidence, TTL/deletion state; never permanently public |

## Typed API contracts (illustrative)

```ts
type Ownership = 'OWNED' | 'WISHLIST' | 'REMOVED';
type Occ = 'GENERAL' | 'GYM' | 'DATE' | 'WORK' | 'PARTY' | 'ERRANDS' | 'CUSTOM';
type ComboEvidence =
  | 'brand_guidance'
  | 'community_corroborated'
  | 'single_anecdote'
  | 'dupe_adapted_hypothesis'
  | 'model_hypothesis';

type WearContext = {
  occasion: Occ;
  eventAtLocal: string; // local wall-clock datetime
  timezone: string; // IANA
  weather?: {
    tempC: number;
    feelsLikeC?: number;
    humidityPct?: number;
    precipChancePct?: number;
    windKph?: number;
    source: 'provider' | 'user_override';
    observedAt: string;
  };
  setting: 'INDOOR' | 'OUTDOOR' | 'MIXED' | 'UNKNOWN';
  crowd: 'LOW' | 'MODERATE' | 'DENSE' | 'UNKNOWN';
  durationHours?: number;
  venueScentPolicy?: 'FREE' | 'LOW_SCENT' | 'NO_FRAGRANCE';
};

type RecommendationRequest = {
  userId: string;
  ownedBottleIds: string[]; // server-authorized; never trust user-supplied list
  context: WearContext;
  mode: 'SOLO' | 'COMBO';
  allowSingleAnecdotes?: boolean;
  allowExperimental?: boolean;
  excludedVariantIds?: string[];
};

type RecommendationResult = {
  variantIds: string[]; // 1 SOLO, exactly 2 COMBO
  userBottleIds: string[];
  score: number;
  rank: number;
  reasonCodes: string[];
  evidenceTier?: ComboEvidence;
  sourceIds: string[];
  substitution?: {
    replacedOriginalVariantId: string;
    ownedReplacementVariantId: string;
    dupeEdgeId: string;
    caveats: string[];
  };
  cautions: string[];
  engineVersion: string;
};
```

## Access and validation
- All user tables enforce owner scoping at DB/policy and server level; tests must verify cross-account denial.
- Public catalog writes are limited to research/admin review; user-supplied manual scent metadata remains scoped to user until explicitly moderated/published.
- Product identity/combo integrity requires referential integrity and valid source/rights state; rejected/unreviewed facts must not enter recommendation production.
- Unique report contribution deduplicates source/author appropriately without unsafe personal data accumulation.
- An owned user's manually entered unknown item can be shown in wardrobe but should not receive invented canonical notes or source-backed combo status.
- All explanations originate from machine-readable `reasonCodes` and linked claims; free-text AI may only paraphrase the grounded data.

## Retrieval and indexing
Full-text search over normalized names, aliases, brands and line; trigram fuzzy matching as needed. Useful relational indexes: user_bottles(user_id, ownership), variant house/name, combo pair, dupe graph source/target, claims(subject, status), sources(rights). Vector embeddings may improve semantic candidate retrieval but must not be a source of factual truth.
