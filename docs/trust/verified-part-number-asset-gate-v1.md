# Verified Part Number Asset Gate V1.0

**Status:** Specification / implementation authorization boundary\\
**Version:** 1.0\\
**Scope:** Rules only. This document does not authorize data mutation, importing, deployment, schema changes, or changes to legacy production statuses.

## 1. Purpose

Define a deterministic, auditable trust decision process for mining spare-part assets. The gate separates data format, PN identity, equipment fitment, and publication. It prevents importer metadata or copied evidence text from being mistaken for proof.

## 2. Scope

The gate applies to a `PartNumber` and to every `PartNumber × Equipment × Evidence` relationship. It produces explicit decisions for a dry run or a future implementation.

Out of scope: changing current importer behavior, changing Prisma, importing data, retroactively rewriting the 160 existing production assets, and treating simulation outputs as production verification.

## 3. Definitions

| Term | Definition |
|---|---|
| RAW | A source row before format validation. |
| FORMAT_READY | A row valid for persistence shape, not a trust decision. |
| FORMAT_HOLD | A row blocked by a format condition. |
| FORMAT_ALIAS_REVIEW | A normalized collision group blocked pending alias resolution. |
| PN identity | The assertion that a part number identifies the stated part. |
| Fitment | The assertion that a PN fits one specific equipment model. |
| Provenance | A source reference sufficient to reproduce an evidence claim. |
| Trusted Asset | An asset passing Format, PN Identity, Fitment, and Publish gates. |

## 4. Trust Model

```text
RAW
  -> FORMAT GATE
  -> PN IDENTITY GATE
  -> FITMENT GATE (one decision per PN × Equipment × Evidence)
  -> PUBLISH GATE
```

The following equivalences are prohibited:

- `FORMAT_READY != VERIFIED`
- `PN VERIFIED != FITMENT VERIFIED`
- `FITMENT VERIFIED != PUBLISH READY`
- a CSV `verification=VERIFIED` value is not a trust decision

## 5. Format Gate

### 5.1 Outcomes

| Outcome | Required condition |
|---|---|
| FORMAT_READY | All format checks pass and no normalized alias collision exists. |
| FORMAT_HOLD | Any blocking format check fails. |
| FORMAT_ALIAS_REVIEW | Normalized PN collides with a distinct original PN form. |

### 5.2 Required checks

1. PN must be nonempty and syntactically valid for the accepted PN character policy.
2. Normalized PN must be nonempty.
3. Distinct original PN values sharing a normalized PN are `FORMAT_ALIAS_REVIEW`; every member is held.
4. Slug must be derivable and collision-free in the target namespace.
5. Required persistence fields must be present or safely derivable: PN, slug, name, category.
6. Exact, normalized, and slug collisions with persisted assets must be reported, never silently overwritten.
7. Malformed PN, missing required field, or unresolved collision is FORMAT_HOLD.

`SINGLE_READY` is deprecated terminology. Its formal V1 replacement is `FORMAT_READY`; neither term has trust authority.

## 6. PN Identity Gate

### 6.1 Evidence classes

Evidence class is independent from verification decision.

| Evidence class | Minimum evidence |
|---|---|
| OFFICIAL | Provenance identifies a recognized manufacturer/official source and a locatable claim (for the current baseline, the user-confirmed `伊泰LS190-ED10配件手册.pdf` plus manual page; item is preferred where present). |
| CORROBORATED | At least two independent historical business sources with locatable records, or a documented PO/RFQ/history cross-check, consistently supporting PN identity. |
| HISTORICAL_SINGLE | One locatable historical business source only. |
| INFERRED | An inference, normalization, AI statement, or descriptive similarity without independently reproducible primary/historical support. |
| CONFLICTED | Sources materially disagree on identity, description, supersession, or required provenance cannot be reconciled. |

`source_files` being nonempty, a filename containing `manual`, or copied text claiming a manual match is insufficient for OFFICIAL by itself.

### 6.2 PN decisions

| Evidence class | AUTO_VERIFIED | REVIEW | HOLD |
|---|---|---|---|
| OFFICIAL | Yes, when provenance and locator are complete and no conflict exists | Missing locator/ambiguity | Conflict or broken provenance |
| CORROBORATED | Yes, when independent sources are locatable and consistent | Scope/provenance ambiguity | Material conflict |
| HISTORICAL_SINGLE | No | Default | Contradiction or unusable source |
| INFERRED | No | Default | Missing evidence or conflict |
| CONFLICTED | No | Only after conflict is bounded | Default while unresolved |

Any `model_evidence != EXPLICIT` or LOW confidence record cannot be PN AUTO_VERIFIED until independent evidence resolves the limitation.

## 7. Fitment Gate

### 7.1 Minimum trust unit

The minimal fitment trust unit is:

```text
PartNumber × Equipment identity × relationship-level evidence
```

PN-level identity evidence cannot be copied to multiple equipment relationships and treated as independent fitment proof.

### 7.2 Fitment outcomes

| Outcome | Rule |
|---|---|
| AUTO_VERIFIED | Model is present; relationship is ACTIVE; model evidence is EXPLICIT; PN identity is AUTO_VERIFIED; relationship evidence directly locates and supports that model; no unresolved conflict exists. |
| REVIEW | Evidence is plausible but model-specific provenance is absent, copied/ambiguous, incomplete, or PN identity is in REVIEW. |
| HOLD | Relationship has a material conflict or an active relation fails a mandatory integrity/provenance condition that cannot be reviewed safely. |
| MODEL_PENDING | Model is empty, `confirmed_models` is empty, `model_evidence != EXPLICIT`, or `relation_status=MODEL_PENDING`. |

Rules:

1. MODEL_PENDING is never AUTO_VERIFIED.
2. `EXPLICIT` from legacy/importer output alone is not sufficient; the underlying relation evidence must be evaluated.
3. Each equipment identity in a multi-model PN receives an independent decision.
4. Relation provenance must retain source identity, page/item or row locator, extraction context, and the equipment model asserted. A parent PN `evidenceSummary` copied to all children does not meet this requirement.

## 8. Publish Gate

An asset is `PUBLISH_READY` as a Trusted Asset only when all are true:

```text
FORMAT_READY
AND PN identity = AUTO_VERIFIED
AND every required active fitment relation = AUTO_VERIFIED
AND no unresolved conflict
AND required audit record exists
```

Otherwise the record may exist as data but must not be publicly represented as a Trusted Asset. A REVIEW or MODEL_PENDING relation blocks trusted publication for the affected asset/fitment scope.

## 9. Importer Authority Boundary

The importer has no trust-granting authority.

| Importer may | Importer must not |
|---|---|
| Parse input; perform collision checks; prepare transactions; persist approved gate output; roll back failures; resume a pre-approved queue | Set VERIFIED/READY/EXPLICIT by default; infer trust from CSV flags; manufacture fallback evidence; treat a nonempty source field as proof; silently alter evidence class or publication decision |

Trust decisions must be explicit Asset Gate output with an evidence reference and audit trail. Persistence is downstream of the gate, not the gate itself.

## 10. Human Review Authority

Authorized human review transitions are:

```text
REVIEW -> VERIFIED
REVIEW -> HOLD
HOLD -> REVIEW
VERIFIED -> REVIEW
```

Every decision must create an immutable audit entry containing reviewer identity, timestamp, reason, evidence reference(s), old status, new status, affected PN/relationship scope, and conflict disposition. No silent state change is allowed.

## 11. Legacy Asset Policy

The current 160 production assets are preserved:

- 154 OFFICIAL and 1 CORROBORATED remain available; no immediate rollback.
- 5 REVIEW PNs enter the **Legacy Verified Review Queue**: `016-63028`, `4697280`, `4699377`, `55025218`, `56006630`.
- Queue placement does not automatically downgrade, delete, or conceal the existing asset.
- A subsequent human decision must use the audit requirements in section 10.

## 12. Audit Requirements

Every gate evaluation must record:

1. source dataset/version and input row identity;
2. normalized PN and collision result;
3. PN evidence class and decision with rule identifier;
4. per-equipment relationship evidence, decision, and provenance locator;
5. publish decision and blocking reason, if any;
6. evaluator version, timestamp, and deterministic input hash where available.

## 13. Multi-Model Policy

ED10 and LS190 are separate equipment identities. For the audited 17 multi-model PNs, every ED10 and LS190 relationship must be evaluated independently. A summary that includes both model names does not prove both. Current baseline: 17 total, 2 existing, 15 remaining.

## 14. Acceptance Tests

Future implementation must provide deterministic tests using the real audit fixtures below. Tests evaluate decisions only; no test writes production data.

| # | Case | Fixture / expectation |
|---:|---|---|
| 1 | OFFICIAL + explicit fitment | PN with confirmed manual page/item and model-specific ED10 evidence returns PN AUTO_VERIFIED and ED10 fitment AUTO_VERIFIED. |
| 2 | CORROBORATED PN | `A2U900-472057` returns PN CORROBORATED; it is not OFFICIAL merely from file names. |
| 3 | HISTORICAL_SINGLE | One locatable historical-source fixture returns REVIEW, never automatic verification. |
| 4 | NOT_EXPLICIT + LOW | `A2U913-651005` returns PN HOLD and FITMENT MODEL_PENDING. |
| 5 | EXPLICIT + MEDIUM | `A2U900-472057` requires evidence evaluation; EXPLICIT/MEDIUM flags alone do not grant fitment AUTO_VERIFIED. |
| 6 | MODEL_PENDING | `A2U220-193386`, `A2U900-472060`, and `A2U900-472055` cannot enter fitment AUTO_VERIFIED. |
| 7 | normalized alias collision | Distinct originals normalizing to one key return FORMAT_ALIAS_REVIEW for every member. |
| 8 | multi-model PN | `106-03455` and `114-8516LFL` obtain separate ED10 and LS190 results; no cross-model inheritance. |
| 9 | evidence conflict | Materially conflicting provenance returns PN/fitment HOLD or REVIEW, never AUTO_VERIFIED. |
| 10 | evidence missing | Missing locator/provenance returns REVIEW or HOLD according to scope; never AUTO_VERIFIED. |
| 11 | legacy verified review | Each of the five legacy REVIEW PNs remains preserved and creates a review-queue item, not an automatic downgrade. |
| 12 | PN verified, fitment review | PN AUTO_VERIFIED with one copied/ambiguous relationship is not PUBLISH_READY. |
| 13 | fitment verified, publish blocked | A valid fitment with FORMAT_HOLD, PN REVIEW/HOLD, or unresolved conflict is not PUBLISH_READY. |

The five mandatory boundary fixtures are `A2U913-651005`, `A2U220-193386`, `A2U900-472060`, `A2U900-472057`, and `A2U900-472055`.

## 15. Current Baseline

| Metric | Frozen baseline |
|---|---:|
| RAW | 1,596 |
| FORMAT_HOLD | 50 |
| FORMAT_READY | 1,546 |
| Existing production | 160 |
| Remaining format-ready | 1,386 |
| Existing PN: OFFICIAL / CORROBORATED / REVIEW / HOLD | 154 / 1 / 5 / 0 |
| Remaining PN: OFFICIAL / CORROBORATED / REVIEW / HOLD | 1,343 / 14 / 25 / 4 |
| Remaining PN simulation: AUTO / REVIEW / HOLD | 1,357 / 25 / 4 |
| Remaining fitment rows: AUTO / REVIEW / HOLD / MODEL_PENDING | 1,343 / 54 / 0 / 4 |
| COMPLETE_AUTO_CANDIDATES | 1,328 |
| PN-IMPORT-01 / PN-EQ-01 | CONFIRMED / CONFIRMED |

`1328 COMPLETE_AUTO_CANDIDATES` is a simulation candidate pool only. It authorizes neither import nor status mutation. A future implementation must dry-run again, pass all acceptance tests, and receive human approval before any production import is considered.

## 16. Implementation Requirements

1. Implement the Asset Gate as an explicit, deterministic decision layer before any trust-status persistence.
2. Keep PN identity evidence and relationship evidence in separate inputs/outputs.
3. Make the decision model dry-run capable and auditable.
4. Preserve legacy state while creating explicit review-queue records only under approved future implementation.
5. Require a fresh dry run against the then-current source data and production collision state.
6. Do not modify importer authority until the gate output contract and acceptance tests exist.

## 17. Non-Goals

- No importer rewrite in this phase.
- No schema or migration proposal is applied by this document.
- No CSV or database normalization is performed.
- No legacy asset is automatically downgraded or rolled back.
- No production deployment or import is authorized.

## 18. Go / No-Go Criteria

**GO for implementation planning only** when the decision model, provenance contract, audit log contract, and all acceptance tests are approved.

**NO-GO for production import** until all are true:

1. implemented gate reproduces the frozen baseline in dry run;
2. acceptance tests pass;
3. relationship-level provenance is available for each intended publishable fitment;
4. unresolved REVIEW/HOLD/MODEL_PENDING records are excluded from trusted publication;
5. an authorized human approves the candidate batch.

This specification itself does not satisfy the production-import criteria.
