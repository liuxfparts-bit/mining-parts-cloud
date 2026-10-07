# Verified Part Number Asset Gate V1.0 — Implementation Plan

**Status:** Active governance plan; Phase 1 complete, Phase 2+ not started\\
**Rule source:** [Verified Part Number Asset Gate V1.0](verified-part-number-asset-gate-v1.md)\\
**Audit source:** [Pre-Audit](../audit/verified-part-number-asset-gate-v1-preaudit.md)

## 1. Executive Summary

This plan translates the frozen V1.0 specification into small, reversible implementation phases. It does not alter the Gate rules. No production import, migration, legacy-state change, importer change, or deployment is authorized by this document.

The current platform already has useful primitives—normalized PN, PN and relation verification fields, source-summary fields, and PN audit logs—but cannot represent the complete V1 contract. In particular, it lacks immutable, multi-source relationship provenance and relationship-level review history. The recommended target is an explicit gate engine that produces a versioned Decision Manifest, followed by controlled persistence and review workflows.

## Current Implementation Status

| Item | Status |
|---|---|
| Phase 1 — Gate Engine + Tests | **MERGED / APPROVED**; PR #28; `main` merge commit `fe5d73f2110a7bcce4fea5be6ff2fc28715ee86f` |
| Phase 2 — Canonical JSON Decision Manifest | **NOT STARTED** |
| Phases 3–8 | **NOT STARTED** |
| Production deployment for this work | **NO** |
| Production Part Number import | **NO** |
| `1328` imported | **NO**; it remains a dry-run candidate baseline |

The roadmap below is retained in its original order. The Phase 1 recommendation has now been completed; the next implementation phase is Phase 2 — Canonical JSON Decision Manifest.

## 2. Current Architecture

```text
CSV -> scripts/import-part-numbers.ts -> PartNumber / PartNumberEquipment / PartNumberAuditLog
                                         |
                                         +-> public pages, search, equipment pages, sitemap

Target:
CSV/source -> parser -> Format Gate -> evidence classifier -> PN Gate
           -> Fitment Gate -> Publish Gate -> Decision Manifest -> importer/persistence
```

Current importer logic combines formatting, collision detection, persistence, and trust-status assignment. Public pages are inconsistently gated: some use `verificationStatus + publishStatus`; others only use `publishStatus=READY`.

## 3. Code Impact Map

| Path | Current responsibility | Impact | Classification | Recommended action |
|---|---|---|---|---|
| `scripts/import-part-numbers.ts` | Parses CSV, detects aliases, previews/resumes, writes PN/relation/audit rows, assigns trust flags | PN-IMPORT-01 | MODIFY | Consume an approved Decision Manifest; remove all trust derivation/defaults in a later phase. |
| `prisma/schema.prisma` | Defines PartNumber, PartNumberEquipment, PartNumberAuditLog and enums | V1 provenance/review gaps | MODIFY | Add only after engine/manifest contract approval; see section 5. |
| `src/lib/part-number.ts` | PN normalization and `PUBLIC_PN_WHERE` | Public trust boundary | MODIFY | Retain normalization; replace raw where constant over time with domain predicates. |
| `src/lib/public-product.ts` | Public product query filters | Nested public trust dependency | MODIFY | Compose shared trusted-PN predicate rather than only READY. |
| `src/app/admin/actions.ts` | PN admin status transition and audit log | Existing review is PN-only and coarse | MODIFY | Route transitions through review service/gate decision; require evidence reference and real reviewer. |
| `src/app/admin/part-numbers/page.tsx` | PN listing/status filters | Needs gate/read-model visibility | MODIFY | Add format/evidence/fitment/review-queue views. |
| `src/app/admin/part-numbers/[id]/page.tsx` | PN and relation evidence detail; manual status form | No relationship review workflow | MODIFY | Show manifest/provenance and relation-level decisions/history. |
| `src/app/part-number/[partNumber]/page.tsx` | Public PN detail, relation display and RFQ prefill | Direct checks and relation visibility | MODIFY | Use shared publication predicate; expose only trusted fitments; preserve non-trusted data only in admin. |
| `src/app/part-number/page.tsx` | Public PN discovery | Uses `PUBLIC_PN_WHERE` | MODIFY | Adopt shared trusted-asset predicate. |
| `src/app/api/part-number/search/route.ts` | Public PN search API | Uses `PUBLIC_PN_WHERE` | MODIFY | Adopt shared trusted-asset predicate. |
| `src/app/search/page.tsx` | General public search | Uses `publishStatus=READY` only | MODIFY | Replace with shared predicate; exact redirect must not disclose unpublished PN. |
| `src/app/equipment/page.tsx` | Equipment listing/counts | Counts relations for READY PN only | MODIFY | Count only trusted fitments, not all relations of a ready PN. |
| `src/app/equipment/[slug]/page.tsx` | Equipment detail/listing | Filters PN only by READY | MODIFY | Filter through trusted fitment relation. |
| `src/app/brands/page.tsx`, `src/app/brands/[slug]/page.tsx` | Brand counts/listings | Counts READY PN only | MODIFY | Use trusted public asset predicate. |
| `src/app/m/page.tsx` | Mobile PN cards | Uses READY only | MODIFY | Use shared trusted predicate. |
| `src/app/sitemap.ts` | Public index generation | Uses READY only | MODIFY | Emit only publishable trusted assets. |
| `src/app/actions.ts` / RFQ paths | May consume selected PN attributes | Trust adjacency | REVIEW | Verify future prefill only uses trusted fitment; avoid changing RFQ authorization semantics. |
| `scripts/verify-stage32-import.ts`, `scripts/verify-stage33-*.ts` | Legacy import verification | Baseline/regression evidence | MODIFY | Replace assumptions about imported VERIFIED/READY with manifest assertions. |
| Existing lifecycle/RFQ tests | Unrelated RFQ behavior | No gate rule impact | NO_CHANGE | Preserve and run as regression tests. |
| New `src/lib/asset-gate/*` | Not present | New decision layer | NEW | Pure deterministic engine and types. |
| New manifest validators/fixtures/tests | Not present | Contract and regression coverage | NEW | Add before importer refactor. |

`DEPRECATE`: importer-owned trust assignment, legacy `verified` as a public-trust signal, and page-local `publishStatus=READY` predicates.

## 4. Schema Capability Audit

### 4.1 PartNumber

| Requirement | Current capability | Gap / reuse decision |
|---|---|---|
| Normalized identity/collision | `number`, `slug`, `normalizedPartNumber` | Reuse; collisions need gate output, not importer-only output. |
| Format status | None | GAP: no FORMAT_READY/HOLD/ALIAS_REVIEW persistence/read model. |
| PN evidence class | `modelEvidence`, `confidence`, summaries/sources | GAP: model evidence is not PN evidence class; no OFFICIAL/CORROBORATED/HISTORICAL_SINGLE/INFERRED/CONFLICTED enum. |
| PN decision | `verificationStatus` | Partial reuse; enum has no REVIEW/HOLD distinction and conflates prior lifecycle meanings. |
| Publish decision | `publishStatus` | Partial reuse; no provenance for why READY/HOLD was decided. |
| Reviewer/time | `verifiedById`, `lastVerifiedAt` | Partial; insufficient for all review transitions/reasons/evidence references. |

### 4.2 PartNumberEquipment

| Requirement | Current capability | Gap / reuse decision |
|---|---|---|
| PN × Equipment identity | Unique `(partNumberId, equipmentModelId)` | Reuse. |
| Relation evidence summary | `evidenceSummary` | Partial; one mutable text summary cannot model multiple sources. |
| Source locator | `sourceReference` | Partial; production audit found 0/162 populated for legacy relations. |
| Fitment evidence class | `evidenceStatus` | Insufficient; only EXPLICIT/INFERRED/NOT_EXPLICIT. |
| Fitment decision | `verificationStatus` | Partial; lacks REVIEW/HOLD/MODEL_PENDING semantics. |
| Relationship audit/reviewer | None | GAP. |
| Multiple evidence references | None | GAP. |

### 4.3 PartNumberAuditLog

| Requirement | Current capability | Gap / reuse decision |
|---|---|---|
| PN transition audit | action, old/new verification/publish, reason, actor/time | Reuse as part of PN audit history. |
| Relationship-level transition audit | No relationship key | GAP. |
| Evidence reference and gate version | free-text reason only | GAP: needs structured reference/version or associated decision record. |
| Reviewer identity | `changedById` nullable | Reuse only after authentication/service requires a valid admin user; never hard-code `0`. |

### 4.4 Capability conclusion

Schema change is required for full V1 persistence. Existing fields can remain compatibility/read-model fields during migration, but cannot faithfully represent all gate decisions, relationship provenance, or review history.

## 5. PN-EQ-01 Remediation Plan

### Option A — extend `PartNumberEquipment`

Add relation-level decision/evidence-class fields and store an array/JSON-like source payload on the relation.

| Dimension | Assessment |
|---|---|
| Provenance clarity | Moderate; one row still combines relation state and many evidence items. |
| Auditability | Moderate; needs a separate audit model anyway. |
| Multiple sources | Weak-to-moderate; JSON sacrifices relational queryability/constraints. |
| Cross-reference/manuaI/PO/RFQ support | Harder to query or reuse. |
| Migration complexity | Lower initial migration cost. |
| API/admin complexity | Lower first UI cost, higher future editing/validation complexity. |

### Option B — independent relationship-evidence model (recommended)

Keep `PartNumberEquipment` as the relationship aggregate and add a child evidence model, plus relationship decision/review audit model. Each evidence item references one relationship and has source type, source identifier, locator (page/item/row), quoted/extracted claim, provenance status, and creation/audit metadata.

| Dimension | Assessment |
|---|---|
| Provenance clarity | High; evidence is explicitly PN × Equipment scoped. |
| Auditability | High; each source and review decision can be retained. |
| Multiple sources | Native one-to-many support. |
| Cross-reference/manual/PO/RFQ support | Queryable and reusable with source type/locator. |
| Migration complexity | Higher but bounded and additive. |
| API/admin complexity | Higher initial work; materially safer future review UX. |

**Recommendation:** Option B. It directly satisfies the V1 minimal trust unit and prevents another copied-PN-summary relation grant. Keep legacy `evidenceSummary` / `sourceReference` as migrated compatibility/display fields until normalized evidence is available.

## 6. PN-IMPORT-01 Remediation Plan

Target authority chain:

```text
CSV/source -> Parser -> Format Gate -> Evidence Classifier -> PN Identity Gate
           -> Fitment Gate -> Publish Gate -> Decision Manifest -> Importer -> Persistence
```

The importer must receive a validated manifest and may only:

- validate manifest version/schema/checksum and collision state;
- persist approved decisions in a transaction;
- roll back on conflict/failure;
- resume a previously identified, manifest-backed queue.

It must not set `verified`, `verificationStatus`, `publishStatus`, `evidenceStatus`, or fallback evidence from CSV/default text. Any current hard-coded assignment is removed only in the later importer-refactor phase, after the manifest contract is proven.

## 7. Decision Manifest Design

### Recommendation

Create a versioned, validated `asset-gate-decision-manifest.json` as a build artifact, not business data. It is the handoff between pure evaluation and persistence.

The canonical decision payload and operational metadata are distinct. The canonical payload must be deterministic and must not automatically include wall-clock `evaluatedAt`/`generatedAt`, random UUIDs, hostname, username, machine absolute paths, or temporary paths. If operational timing is needed, it belongs in a non-canonical envelope or is explicitly excluded from canonical serialization and the manifest fingerprint. Phase 2 should prefer no wall-clock timestamp in the canonical payload.

```json
{
  "gateVersion": "v1",
  "input": { "datasetVersion": "...", "hash": "..." },
  "partNumbers": [{
    "partNumber": "...",
    "formatStatus": "FORMAT_READY",
    "evidenceClass": "OFFICIAL",
    "pnDecision": "AUTO_VERIFIED",
    "pnReason": "...",
    "fitments": [{
      "equipment": "ED10",
      "evidenceClass": "OFFICIAL",
      "decision": "AUTO_VERIFIED",
      "evidenceReferences": [{ "source": "...", "locator": "page 5, item 1" }],
      "reason": "..."
    }],
    "publishDecision": "PUBLISH_READY"
  }]
}
```

| Use | Manifest value |
|---|---|
| Dry run | Deterministic count/baseline comparison without DB write. |
| Human review | Immutable input snapshot and explicit reason/evidence display. |
| Audit | Gate version, source hash, decision and reason are reproducible. |
| Resume | Queue contains manifest IDs/checksum, never inferred status. |
| Import | Importer validates and persists only approved manifest outcomes. |
| Regression | Fixture/full-dataset output can be compared to frozen 1,328 baseline. |

CSV export may be generated for operations review, but JSON is the canonical nested fitment representation.

An optional non-canonical operational envelope may carry `evaluatedAt` for run observability; it is not part of the canonical decision payload or its fingerprint.

## 8. Gate Engine Architecture

Implement a pure domain layer with no Prisma, Next, or filesystem side effects:

```text
parse inputs -> normalize -> format decision -> evidence classification
             -> PN decision -> relation decisions -> publish decision -> manifest
```

Proposed modules: `asset-gate/types`, `normalize`, `format-gate`, `evidence-classifier`, `pn-identity-gate`, `fitment-gate`, `publish-gate`, `manifest`, and `public-trust`.

The engine must accept explicit source/evidence inputs and return decisions/reasons. Persistence, admin UX, importer, and pages consume the decision contract; they do not recreate rule logic.

## 9. Human Review Architecture

Workflow:

```text
REVIEW -> admin evidence view -> VERIFY | HOLD | REQUEST_MORE_EVIDENCE
```

Required future components:

1. Admin queue filtered by PN and relation decision.
2. Detail view showing original source, locator, claim, manifest version, and conflicts.
3. Server-side authorization through the current authenticated admin identity, never `changedById=0`.
4. Transactional review action with old/new status, reason, references, reviewer, timestamp, and gate version.
5. Immutable audit history for both PN and relationship decisions.

## 10. Legacy 160 Plan

Do not re-import, overwrite, or roll back the 160 records.

| Cohort | Plan |
|---|---|
| 154 OFFICIAL + 1 CORROBORATED | Preserve current production state; attach normalized provenance only in a later approved phase. |
| 5 REVIEW | Create Legacy Verified Review Queue entries in a dedicated future migration/workflow; preserve current public state until a human decision. |

The queue is not a surrogate for silent state change. It requires schema support, an admin queue/detail UI, and structured audit events.

## 11. Public Trust Boundary

### Found boundaries

| Surface | Current predicate | Required future predicate |
|---|---|---|
| `src/lib/part-number.ts` / `/part-number` / API search | VERIFIED + READY | `isPublishableTrustedAsset` |
| `src/app/part-number/[partNumber]/page.tsx` | direct VERIFIED + READY check; relation rows displayed | asset predicate plus `isTrustedFitment` for each displayed equipment/RFQ prefill. |
| `/equipment`, `/equipment/[slug]` | READY PN relation | trusted fitment relation, not merely ready parent PN. |
| `/search` | READY only | shared asset predicate; exact redirect must use it too. |
| `/brands`, brand detail | READY counts/listing | shared asset predicate. |
| `/m` | READY only | shared asset predicate. |
| `/sitemap.ts` | READY only | shared asset predicate. |
| `src/lib/public-product.ts` | product/supplier verification plus parent READY | shared asset predicate nested in product visibility. |

Plan a single domain service API:

```text
isTrustedPartNumber(pn)
isTrustedFitment(relation)
isPublishableTrustedAsset(pn, relations)
trustedPartNumberWhere()
trustedFitmentWhere()
```

Page-local `verified && READY` composition is prohibited after rollout. Public filtering must be updated atomically with the persistence/read-model contract so legacy assets do not disappear unintentionally.

## 12. Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | Normalization, alias collision, evidence classes, each decision branch, no side effects. |
| Gate | Full pipeline decisions and reasons for OFFICIAL/CORROBORATED/HISTORICAL_SINGLE/INFERRED/CONFLICTED. |
| Manifest | Schema/version/hash validation, deterministic ordering, invalid manifests rejected. |
| Importer | Reject absent/invalid manifest; persist only approved outcomes; transaction rollback; no self-granted status. |
| Regression | Full V3 input must yield 1,328 complete auto candidates; any difference blocks dry run absent approved rule change. |
| Legacy | Preserve 160, create only review queue for five named REVIEW PNs, no automatic downgrade. |
| Public boundary | Search, detail, equipment, sitemap, mobile, brands, and products consume only trusted predicates. |

Mandatory fixtures: `A2U913-651005`, `A2U220-193386`, `A2U900-472060`, `A2U900-472057`, `A2U900-472055`, `106-03455`, `114-8516LFL`.

## 13. Migration Strategy

No migration is authorized in this phase. When implementation reaches schema work, use additive migrations only:

1. add new evidence/decision/audit structures without changing legacy status fields;
2. deploy read/write support behind a feature flag or non-public path;
3. backfill only from approved manifests, never inferred from existing VERIFIED/READY flags;
4. validate counts/provenance before moving public filters;
5. retain rollback ability by disabling new reads, not deleting evidence.

## 14. Phased Implementation

| Phase | Purpose / files | Schema change | DB write | Tests / acceptance | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Pure Gate Engine + fixtures under `src/lib/asset-gate`, tests | No | No | All V1 acceptance tests; 1,328 baseline | Revert isolated code. |
| 2 | Manifest generator/validator and dry-run CLI | No | No | Deterministic manifest/hash/counts | Delete generated artifacts; no data impact. |
| 3 | Provenance/decision schema and repository layer | Yes, additive | Controlled test DB only | Migration and repository tests | Disable feature path; retain added tables. |
| 4 | Admin human-review queue/detail/actions | Likely uses phase-3 schema | Yes, explicit review only | Authorization/audit/transition tests | Disable UI/actions; audit stays immutable. |
| 5 | Importer refactor to require manifest | No further mandatory schema | Only approved future import | Invalid manifest rejection; rollback | Keep importer blocked / restore prior binary behavior without running it. |
| 6 | Legacy 160 normalization queue | Possibly phase-3 structures only | Queue/audit creation only | 160 preservation; five queue entries | Remove queue visibility, never delete audit. |
| 7 | Full V3 dry run | No | No | Exact baseline: 1,328; all gate counts close | Discard manifest. |
| 8 | Production import approval | No unapproved schema | Yes, only after approval | Go/no-go checklist and transaction rehearsal | Transaction rollback / no partial publish. |

## 15. Rollback Strategy

The primary safety boundary is separation of evaluation from persistence. Before Phase 8, all work is either code-only, additive schema, or dry-run manifest generation. Public trust reads switch only after gate/read-model consistency tests pass. Never roll back by deleting provenance or audit history; disable the new trust read path and investigate from immutable manifests/audit records.

## 16. Security and Audit Considerations

1. Review actions require authenticated authorized admin identity from session, not a constant ID.
2. Evidence source text is untrusted input; UI must render safely and validate source references.
3. Manifests must carry version and input hash; approval must bind to that hash.
4. Transactions must re-check collision and manifest identity at write time.
5. Audit events are append-only operational evidence, not editable comments.
6. Public APIs must not reveal HOLD/REVIEW assets through exact-search redirects, sitemap, equipment counts, or related-PN queries.

## 17. Go / No-Go Criteria

| Transition | GO only when | NO-GO conditions |
|---|---|---|
| Planning -> Phase 1 | This plan and V1 spec approved; fixture/baseline source available | Any request to import or mutate legacy data. |
| Phase 2 -> migration | Pure engine and manifest tests pass; decisions reproduce V1 fixtures | Rule logic remains embedded in importer/pages. |
| Migration -> dry run | Additive schema/repository and review audit tests pass | Missing provenance contract or migration rollback plan. |
| Dry run -> production import | 1,328 baseline reproduced; acceptance tests pass; human approves manifest; public predicates verified | Any count drift, unresolved gate mismatch, or absent approval. |

**Current status:** Production import is prohibited.

## 18. Recommended First Implementation PR

**Historical planning note:** This Phase 1 recommendation has been completed and merged/approved through PR #28 (`main` merge commit `fe5d73f2110a7bcce4fea5be6ff2fc28715ee86f`). The next implementation phase is Phase 2 — Canonical JSON Decision Manifest; it is not started by this document.

**PR title:** `feat: add pure verified part-number asset gate evaluator`

Scope only Phase 1: pure gate types/functions, real audit fixtures, deterministic acceptance tests, and a test-only baseline assertion for 1,328 complete auto candidates. No Prisma change, no importer change, no database access/write, no public-page change, no manifest persistence, and no legacy-status mutation.
