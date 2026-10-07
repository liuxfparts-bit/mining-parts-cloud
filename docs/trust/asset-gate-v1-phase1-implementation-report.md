# Asset Gate V1.0 — Phase 1 Implementation Report

## 1. Changed Files

- `src/lib/trust/asset-gate/types.ts`
- `src/lib/trust/asset-gate/format-gate.ts`
- `src/lib/trust/asset-gate/evidence-classifier.ts`
- `src/lib/trust/asset-gate/pn-identity-gate.ts`
- `src/lib/trust/asset-gate/fitment-gate.ts`
- `src/lib/trust/asset-gate/publish-gate.ts`
- `src/lib/trust/asset-gate/asset-gate.ts`
- `src/lib/trust/asset-gate/index.ts`
- `scripts/test-asset-gate-v1.ts`
- `package.json` (test command only)

No Prisma schema, migration, importer production-write path, database, CSV, public page/API, admin UI, or legacy production record was modified.

## 2. Gate Architecture

The implementation is a pure, deterministic domain module with no Prisma, filesystem write, network, importer, or database dependency.

```text
Format facts -> Format decision
Structured evidence facts -> Evidence class -> PN decision
PN decision + per-equipment evidence -> Fitment decisions
Format + PN + every fitment + conflict state -> Publish decision
```

`evaluatePartNumberAsset()` is the aggregate entry point. It returns format decision, PN evidence class/decision, independent per-equipment fitment decisions, publish decision, and fixed `gateVersion: V1.0`.

## 3. Types

Defined types:

- `FormatStatus`: `FORMAT_READY`, `FORMAT_HOLD`, `FORMAT_ALIAS_REVIEW`
- `EvidenceClass`: `OFFICIAL`, `CORROBORATED`, `HISTORICAL_SINGLE`, `INFERRED`, `CONFLICTED`
- `PNDecision`: `AUTO_VERIFIED`, `REVIEW`, `HOLD`
- `FitmentDecision`: `AUTO_VERIFIED`, `REVIEW`, `HOLD`, `MODEL_PENDING`
- `PublishDecision`: `READY`, `BLOCKED`

Every decision is a structured object with `decision`, `reasonCode`, and `reasons[]`. Legacy verification/publish fields are accepted only as inert input compatibility facts and are not consulted by the rules.

## 4. Reason Codes

Stable machine-readable reason codes include:

- `FORMAT_PART_NUMBER_EMPTY`, `FORMAT_PART_NUMBER_MALFORMED`, `FORMAT_ALIAS_COLLISION`, `FORMAT_NORMALIZED_COLLISION`, `FORMAT_SLUG_COLLISION`, `FORMAT_REQUIRED_FIELD_MISSING`, `FORMAT_VALID`
- `PN_EVIDENCE_CONFLICT`, `PN_MODEL_EVIDENCE_NOT_EXPLICIT`, `PN_CONFIDENCE_LOW`, `PN_OFFICIAL_EVIDENCE_CONFIRMED`, `PN_CORROBORATED_EVIDENCE_CONFIRMED`, `PN_HISTORICAL_SINGLE_REVIEW`, `PN_EVIDENCE_INFERRED_REVIEW`
- `FITMENT_MODEL_PENDING`, `FITMENT_EVIDENCE_CONFLICT`, `FITMENT_PN_NOT_AUTO_VERIFIED`, `FITMENT_PROVENANCE_INSUFFICIENT`, `FITMENT_EXPLICIT_PROVENANCE_CONFIRMED`
- `PUBLISH_FORMAT_NOT_READY`, `PUBLISH_PN_NOT_AUTO_VERIFIED`, `PUBLISH_UNRESOLVED_CONFLICT`, `PUBLISH_FITMENT_NOT_AUTO_VERIFIED`, `PUBLISH_ALL_GATES_PASSED`

## 5. Test Coverage

The deterministic test script covers:

1. Empty PN, malformed PN, normalized collision, alias collision, slug collision, and missing required field.
2. Manual filename/text, nonempty sources, importer fallback-style evidence, and legacy `verified`/`VERIFIED`/`READY` fields not bypassing the gate.
3. Conflicting and missing evidence.
4. The five mandatory boundary fixtures.
5. Independent ED10/LS190 evaluation for `106-03455` and `114-8516LFL`.
6. Full V3 CSV regression and exact production imported-PN fixture regression.

## 6. Fixture Coverage

| Fixture | Asserted outcome |
|---|---|
| `A2U913-651005` | PN HOLD; fitment MODEL_PENDING |
| `A2U220-193386` | PN HOLD; fitment MODEL_PENDING |
| `A2U900-472060` | PN HOLD; fitment MODEL_PENDING |
| `A2U900-472057` | PN AUTO_VERIFIED by corroboration; LS190 fitment REVIEW |
| `A2U900-472055` | PN HOLD; fitment MODEL_PENDING |
| `106-03455` | ED10 AUTO_VERIFIED; LS190 REVIEW |
| `114-8516LFL` | ED10 AUTO_VERIFIED; LS190 REVIEW |

## 7. Full Dataset Regression

The test reads the source CSVs without modifying them and asserts the frozen baseline:

| Metric | Expected / actual |
|---|---:|
| RAW | 1596 / 1596 |
| FORMAT_HOLD | 50 / 50 |
| FORMAT_READY | 1546 / 1546 |
| Existing fixture | 160 / 160 |
| Remaining format-ready | 1386 / 1386 |
| Remaining PN AUTO / REVIEW / HOLD | 1357 / 25 / 4 |
| Remaining fitment AUTO / REVIEW / HOLD / MODEL_PENDING | 1343 / 54 / 0 / 4 |
| COMPLETE_AUTO_CANDIDATES | **1328 / 1328** |

The regression emits the expected and actual count, plus affected PN list, if the 1328 assertion fails.

## 8. Legacy Regression

The exact user-supplied production fixture is used, not an order-based approximation. Assertions pass for:

```text
total=160
OFFICIAL=154
CORROBORATED=1
REVIEW=5
HOLD=0
```

No legacy state is read from or written to a database.

## 9. Test-Only Audit Fixture Compatibility

The production gate engine intentionally consumes only structured evidence facts. To reproduce the approved V1 pre-audit baseline, the full-dataset regression uses a **test-only audit provenance fixture** recording the human-confirmed fact that `伊泰LS190-ED10配件手册.pdf` is a Sandvik official ED10/LS190 manual. It is not a generic filename/manual heuristic, is not used by production code, and must not become a Phase 2 production evidence normalizer.

The regression separately constructs PN evidence facts from the PN CSV and relationship evidence facts from the relationship CSV. PN evidence is never copied into a relationship. A relationship receives the confirmed-manual fixture only where its own ED10 relationship evidence contains a locatable manual claim; unsupported relationship provenance remains REVIEW/MODEL_PENDING.

## 10. Known Gaps

- No Decision Manifest serialization or validation yet.
- No relationship evidence persistence model, provenance normalization, or relationship audit history.
- No human-review queue or admin action integration.
- No public trust predicate integration.
- The project `tsx` runner cannot start in this environment because Node fails during `os.userInfo()` with `uv_os_get_passwd` / `ENOMEM`. The suite was instead compiled to a temporary directory with TypeScript and executed with Node successfully.
- Direct Next build reached `Creating an optimized production build ...` but the environment did not return an exit code after that stage.

## 11. Explicitly Not Implemented

- Prisma/schema/migration changes
- Database reads or writes
- Importer behavior changes
- Decision Manifest persistence
- Human review UI/workflow
- Public search/API/admin/public-page behavior changes
- Legacy 160 changes
- Any import, deployment, or production mutation

## 12. Phase 2 Readiness

Phase 2 may begin only after this isolated pure-engine scope is reviewed. The next permitted scope is Decision Manifest generation/validation and dry-run output; it must not add persistence, importer trust authority, or production data changes.
