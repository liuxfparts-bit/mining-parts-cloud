# Asset Gate V1 — Phase 2 Canonical JSON Decision Manifest

## Scope

Phase 2 adds a deterministic, machine-readable decision-manifest contract around the approved Phase 1 Asset Gate V1 engine. The manifest is a representation of Gate decisions, not a second Trust engine and not an import instruction.

- Baseline SHA: `be1963f1de30aebbd62a77dca58128d9b92fd66d`
- Branch: `codex/asset-gate-v1-phase2-manifest`
- Gate authority: Phase 1 `evaluatePartNumberAsset()`
- Manifest schema version: `1.0`
- Gate version: existing `GATE_VERSION` (`V1.0`)

## Files and architecture

- `src/lib/trust/asset-gate/manifest.ts` defines the manifest domain model, builder, canonical serializer, SHA-256 fingerprints, summary calculator, and validator.
- `src/lib/trust/asset-gate/types.ts` exports the existing typed Gate reason-code vocabulary as `GATE_REASON_CODES`; this is a runtime view of the same Gate reason-code source, not a semantic change.
- `scripts/test-asset-gate-v1.ts` extends the existing in-memory Phase 1 regression adapter with Manifest integration and tamper tests. It remains test-only and does not provide a production evidence normalizer.

The pipeline is:

```text
normalized test/source facts → Phase 1 Gate Engine → Manifest Builder
→ canonical serializer → SHA-256 fingerprints → Manifest Validator
```

The builder invokes the Gate Engine for every input and copies the resulting decisions. It does not classify evidence, inspect filenames, infer models, upgrade Trust, or make publish decisions.

## Canonical payload and fingerprints

The canonical payload contains `schemaVersion`, `gateVersion`, `sourceFingerprint`, a decision-derived `summary`, and stable-sorted `partNumbers`. The `manifestFingerprint` is returned in a separate artifact envelope, so the canonical payload never hashes itself.

Canonical serialization recursively sorts object keys. The builder additionally stable-sorts Part Numbers, fitments by equipment identity, and evidence/provenance references by their stable reference. Source fingerprinting normalizes unordered fitment input order before serializing normalized Gate input. No canonical field contains runtime timestamps, UUIDs, machine names, user names, paths, process IDs, or temporary locations.

- `sourceFingerprint`: SHA-256 of normalized Gate input only.
- `manifestFingerprint`: SHA-256 of the canonical decision payload.

## Validator behavior

The validator checks supported schema and Gate versions, SHA-256 formatting, manifest fingerprint integrity, duplicate Part Numbers, duplicate fitment equipment within a Part Number, required identifiers, Gate decision/evidence/reason-code enums, structural `READY` consistency, and decision-derived summary counts.

It recomputes the manifest fingerprint and summary from the supplied entries. It deliberately does not invent source facts or recompute a source fingerprint without the source input, which is intentionally not embedded in a decision artifact.

### Review Fix 1 — fail-closed untrusted input boundary

The validator accepts `unknown` and now validates in explicit stages: top-level shape, entry and fitment shape, semantic checks, then summary and fingerprint recomputation. Summary calculation and canonical hashing only run after every required field can safely be read. Malformed JSON-compatible inputs return `valid: false` with typed `code`, `path`, and `message` errors; they do not throw during field access, duplicate checks, summary calculation, or fingerprint validation.

Negative coverage includes null, arrays, primitives, empty objects, missing/null/non-array `partNumbers`, null/primitive/missing Part Number entries, missing/null/non-array/null/primitive fitments, missing equipment, missing/malformed summary, wrong decision primitive, and malformed fingerprints. Existing duplicate, enum, reason-code, summary-tamper, decision-tamper, version, and fingerprint checks remain in place.

## Trust boundary, PN-EQ-01, and multi-model handling

PN evidence references and relationship evidence references are separate inputs and manifest fields. The builder preserves the Gate output for each relationship; PN `OFFICIAL` evidence cannot turn an unrelated relationship into `OFFICIAL` or `AUTO_VERIFIED`.

Each `PartNumber × Equipment` fitment is emitted independently. Multi-model records therefore retain distinct ED10 and LS190 decisions. Empty or non-explicit models retain the Gate's `MODEL_PENDING` decision; the manifest neither guesses an equipment model nor replaces it with a category.

Production code does not use filename matching as provenance proof. The existing user-confirmed manual provenance remains isolated to the explicit, test-only Phase 1 audit fixture.

## Regression contract

The test adapter builds manifests from the same real CSV-driven inputs passed into the Phase 1 engine. It asserts the following dry-run baselines from calculated decisions, never from a manifest constant:

- RAW 1596; FORMAT_HOLD 50; FORMAT_READY 1546.
- Remaining FORMAT_READY 1386.
- Remaining complete auto candidates 1328.
- Remaining fitments: AUTO 1343, REVIEW 54, HOLD 0, MODEL_PENDING 4.
- Legacy 160: OFFICIAL 154, CORROBORATED 1, REVIEW 5, HOLD 0.

The 1328 figure remains a regression baseline only, never import authorization. The existing Legacy 160 is read only; Phase 2 creates no queue and does not mutate production records.

## Test coverage

The extended test script covers canonical byte stability across reordered Part Numbers, fitments, and references; source-fingerprint change detection; decision-fingerprint tampering; summary tampering; duplicate Part Numbers and fitments; unsupported schema/Gate versions; invalid reason codes/enums; PN/relationship evidence separation; multi-model independence; MODEL_PENDING boundary records; the five known boundary PNs; full-dataset 1328; and Legacy 160 154/1/5/0.

## Verification status

The original `npm run test:asset-gate-v1` attempt could not load test code: Node v24.19.0 `os.userInfo()` failed with `uv_os_get_passwd returned ENOMEM (not enough memory)`, preventing `tsx` bootstrap. Final runtime verification used temporary CommonJS compilation and Node execution outside the repository, preserving the source adapter, dataset, Gate Engine, and all test assertions. The complete Phase 1 plus Phase 2 test script now exits 0 with `ASSET_GATE_V1_TESTS=PASS`.

Calculated full-dataset results are RAW 1596, FORMAT_HOLD 50, FORMAT_READY 1546, remaining 1386, PN AUTO/REVIEW/HOLD 1357/25/4, fitment AUTO/REVIEW/HOLD/MODEL_PENDING 1343/54/0/4, and complete auto candidates 1328. Legacy 160 remains OFFICIAL/CORROBORATED/REVIEW/HOLD 154/1/5/0. Both Legacy and Remaining manifests pass validation; Remaining summary and both fingerprints are recomputed and checked. No expected baseline was changed. The 1328 remains a dry-run regression result, not production import authorization.

`node node_modules/typescript/bin/tsc --noEmit` and `npm run build` both completed successfully (exit code 0). No generated full manifest or temporary recovery artifact is added to the repository.

### Targeted validator correction — empty MODEL_PENDING equipment

The Remaining manifest originally produced eight structural errors for four unknown-model records: `A2U220-193386`, `A2U900-472055`, `A2U900-472060`, and `A2U913-651005`. Each fitment had legitimate `MODEL_PENDING` / `FITMENT_MODEL_PENDING` output and empty equipment; an unconditional nonempty equipment guard rejected it and cascaded to the parent PN. Legacy had no empty-equipment fitments and passed its round-trip. The earlier Legacy-failure report was superseded by exact diagnostics.

The structural guard now permits exactly `equipment=""` with `fitmentDecision="MODEL_PENDING"` and `reasonCode="FITMENT_MODEL_PENDING"`. All other required fields and checks remain unchanged. No model is invented, no relationship is omitted, and Phase 1 decisions are preserved. Tests retain all four records and reject empty equipment with AUTO_VERIFIED, REVIEW, HOLD, unsupported decisions, invalid or mismatched reasons, and missing/null/numeric/object equipment. Negative artifacts are rehashed so fingerprint rejection cannot hide structural rejection. Existing malformed, tamper, determinism, multi-model, and PN-EQ-01 coverage passes.

## Known limitations and V1.1 considerations

### Four Major contract corrections and closed schema

The first final review identified four contract defects. They are corrected without changing Phase 1 Gate rules, source data, or expected baselines:

1. Builder checks exact equality of `input.partNumber` and `gateInput.format.partNumber` before evaluating any input. A/B and whitespace-only mismatches reject construction. Fitment evidence metadata contains no second equipment identity; its existing positional count check and duplicate-equipment rejection remain covered by tests. Normalized PN and slug remain Format Gate facts, not replacement asset identities.
2. Validator checks possible Phase 1 output combinations rather than assigning Trust. Format decisions must match their reason family. PN and Fitment decision/reason/evidence combinations follow the current Phase 1 priority. Publish consistency calls the unchanged Phase 1 `evaluatePublish()` and rejects READY with an empty fitment list or any non-AUTO relationship.
3. `canonicalJson` must exist as a string and match the newly serialized canonical payload byte for byte. The manifest fingerprint must match that payload. Source fingerprint format is checked; recomputation requires the original Gate inputs and is performed by the full-dataset regression.
4. Validator snapshots all fields using property descriptors before structural checks. Unsupported values, undefined, cycles, accessors, symbols, sparse or extended arrays, non-plain containers, throwing proxies, and nesting beyond 128 return structured errors. No invalid field is silently dropped. Shared references in schema-defined evidence reference fields are accepted when they are not cycles.

The schema is closed at seven levels: artifact envelope, manifest payload, summary, PN decision, fitment decision, PN evidence reference, and relationship evidence reference. Unknown JSON-valued fields return `MANIFEST_UNEXPECTED_FIELD` even after the supplied payload is rehashed. The test preserves `summary.unexpected`; it does not recalculate summary in a way that would remove that field.

The consistency matrix is limited to facts present in a decision artifact:

| Gate | Phase 1 output consistency retained |
|---|---|
| PN | CONFLICTED requires HOLD/conflict reason; other HOLD outcomes retain model/confidence reasons. OFFICIAL and CORROBORATED AUTO use their matching reasons. HISTORICAL_SINGLE and INFERRED REVIEW use their matching reasons. Evidence class never independently grants Trust. |
| Fitment | MODEL_PENDING precedes conflict and PN checks and uses FITMENT_MODEL_PENDING. Otherwise CONFLICTED requires HOLD. Non-AUTO PN requires REVIEW/PN-not-AUTO. With AUTO PN, insufficient provenance permits REVIEW, while AUTO requires its confirmed-provenance reason and a non-INFERRED/non-CONFLICTED evidence class. HISTORICAL_SINGLE fitment can legitimately be AUTO. |
| Publish | Format failure precedes PN failure, then unresolved conflict, then absent/non-AUTO fitments; READY requires at least one fitment and every fitment AUTO. Multi-model relationships retain separate decisions. |

### Conflict facts and fingerprint limits

The current Manifest has no independent `unresolvedConflict` fact. For `PUBLISH_UNRESOLVED_CONFLICT`, Validator checks decision and priority consistency only. Passing a reason-derived boolean to the existing Publish evaluator does not independently verify a conflict or its underlying evidence. No conflict field is fabricated. Original confidence, model-evidence and provenance facts are likewise not reconstructed from decisions. The source fingerprint is an input hash, and the manifest fingerprint is a payload integrity hash; neither is a digital signature nor proof of source authenticity or authorization to import.

### Second final verification and review — 2026-10-08

Fresh system temporary CommonJS compilation and the complete current test module both exited 0. All 19 test groups passed with 0 failures, including original Phase 1 assertions, identity binding, the legal Phase 1 output matrix, rehashed illegal decisions, canonical envelope failures, hostile unknown inputs, seven-level unknown-field rejection, and schema-defined shared references. Determinism, tamper, malformed validator, PN-EQ-01, multi-model and MODEL_PENDING checks passed. Actual complete auto candidates remain 1328; Legacy remains 154/1/5/0; all four Remaining MODEL_PENDING records retain empty equipment and their original pending reason. Both Legacy and Remaining manifests validate successfully.

`node node_modules/typescript/bin/tsc --noEmit`, `npm run build`, and `git diff --check` passed in the second final verification; typecheck and build each exited 0. Review covered all Phase 2 implementation and test changes, the unchanged reason-code vocabulary, preserved original assertions, evidence scope, error handling, and publication authority. No remaining Blocker, Major or Minor was identified within the Phase 2 scope. This records code-review findings, not human acceptance: `PHASE2_ACCEPTED=NO`.

The worktree contains five intended Phase 2 files (Manifest implementation, barrel export, typed reason-code vocabulary, tests, and this report), plus the tracked generated `tsconfig.tsbuildinfo` cache. Its changes are TypeScript 5.9.3 incremental build metadata. It remains dirty and has not been restored. It must be excluded from any future Phase 2 commit. No schema, migration, importer, production dataset, public UI, package-lock, node_modules, full Manifest output, or temporary recovery file is part of the changes. No staging, commit, push, PR, database mutation, production import, or deployment was performed.

Phase 2 deliberately preserves the Phase 1 `modelEvidence=EXPLICIT` identity/fitment semantic coupling. Reconsidering that coupling is a V1.1 design decision and is out of scope here.

## Explicit non-actions

- NO DATABASE READ
- NO DATABASE WRITE
- NO SCHEMA CHANGE
- NO MIGRATION
- NO IMPORTER CHANGE
- NO PRODUCTION IMPORT
- NO DEPLOYMENT
