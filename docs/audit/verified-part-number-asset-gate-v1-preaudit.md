# Verified Part Number Asset Gate V1.0 — Pre-audit

Audit date: 2026-10-07\\
Scope: read-only analysis of the V3 CSV assets and the supplied prior production-audit facts. No business code, CSV/JSON/XLSX data, database rows, Prisma schema, migration, importer, deployment, or Git history was changed.

> **Authoritative-result notice.** This document preserves the chronological pre-audit record, including preliminary calculations that were later corrected. Sections 16–17 are the authoritative reconciliation. In particular, sections 7–10 are preliminary/historical calculations, not the current baseline: `1432` is a historical incorrect and superseded calculation, while `1328` is the current complete auto-candidate baseline only—not an authorized production-import count.

## 1. Executive Summary

The V3 files contain **1,596** PN assets and **1,609** ACTIVE PN × Equipment relations. The CSVs provide strong PN identity evidence for most rows, but they do not provide independently model-scoped provenance for the relations: all 1,609 ACTIVE relationship `evidence_summary` values are byte-for-byte equal to their parent PN summary.

The most material gate finding is the 17 ED10 + LS190 multi-model PNs. Each has the same copied evidence text in both relations. Every one has an ED10 manual page/item citation, so ED10 fitment is independently supportable. None has a separately generated LS190 relationship citation; LS190 filenames, PO rows, or generic historical records in the copied PN summary are not by themselves proof of LS190 fitment. Those 17 LS190 relations must be REVIEW under this gate.

For PN identity, the conservative classification is 1,568 OFFICIAL, 21 CORROBORATED, 3 REVIEW, and 4 HOLD. The trusted official source is the user-confirmed Sandvik manual `伊泰LS190-ED10配件手册.pdf`; a filename alone was not treated as proof.

## 2. Dataset Inventory

| Asset | Count | Notes |
|---|---:|---|
| PN master CSV | 1,596 | `kuangpeiyun_partnumber_import_v3.csv` |
| ACTIVE relations | 1,609 | 1,592 distinct PNs |
| MODEL_PENDING relations | 4 | no model; not ACTIVE |
| ED10 ACTIVE relations | 1,571 | distinct equipment identity |
| LS190 ACTIVE relations | 38 | distinct equipment identity |
| Multi-model PNs | 17 | ED10 and LS190 must not be conflated |

The CSV's `verification=VERIFIED` and `import_status=PUBLISHED_READY` were excluded from trust decisions because they are uniformly assigned. So were non-empty `source_files` values unless their evidence text was independently locatable.

## 3. Confirmed Importer Findings

### PN-IMPORT-01 — Import readiness is not trust readiness

The current importer treats `SINGLE_READY` as required-field/format readiness (`number`, `slug`, `name`, `category`) and hard-codes verified/ready values. It is not an evidence gate. Its fallback evidence text is not evidence.

### PN-EQ-01 — Fitment evidence provenance gap

The importer persists PN-level summary text onto `PartNumberEquipment`, hard-codes relation evidence/verification states, and does not retain full relationship-CSV semantics. This audit therefore treats a copied PN summary as PN identity material, not automatically as model-specific fitment material.

## 4. Method and Classification Rules

The classification is an audit result, not a database update.

| Class | Rule used |
|---|---|
| OFFICIAL | Locatable official-manual evidence with a page/item (including explicit ED10 manual/schematic locator). |
| CORROBORATED | No locatable official page/item, but explicit evidence of two or more independent historical sources and/or PO corroboration. |
| HISTORICAL_SINGLE | One historical business source only. No rows met this class after HOLD rules. |
| REVIEW | Evidence exists but is narrative, non-locatable as an official source, or does not prove model-specific fitment. |
| HOLD | `model_evidence != EXPLICIT`, LOW confidence, conflict, or insufficient model support. |

For relationship evidence, an equipment name appearing only in a spreadsheet filename is not treated as an independently proven fitment. Direct model/manual language and a page/item locator are required for AUTO_VERIFIED fitment.

## 5. 17 Multi-Model PN Evidence Audit

All 17 pairs have **identical ED10 and LS190 `evidence_summary` values**. The ED10 evidence below independently supports ED10. The listed LS190 material is copied PN-level historical material, not a separately generated LS190 fitment citation; therefore LS190 is REVIEW for each pair.

| PN | Identical copied relationship summary / ED10 source | LS190 source present in copied summary | ED10 independently proven | LS190 independently proven | PN-summary copied to both relations |
|---|---|---|---|---|---|
| 106-03455 | ED10 manual p.5 item 9; LS190-B2285 row 3; Purchase Order-Shanxi row 10 | LS190-B2285 row 3 | Yes | No | Yes |
| 114-8516LFL | ED10 manual p.139 item 2; LS190-312 row 145; LS190-B2285 row 28; PO row 13 | two LS190 workbook rows | Yes | No | Yes |
| 915-26018 | ED10 manual p.49 item 4; LS190-312 row 39; LS190-B2285 rows 110/184; PO row 23 | workbook rows | Yes | No | Yes |
| A2U130-194285 | ED10 manual p.209 item 1; LS190-B2285 row 181; PO row 32 | LS190-B2285 row 181 | Yes | No | Yes |
| A2U220-267113 | ED10 manual p.39 item 18; LS 190-PO row 18; requirement row 25; LS190-312 row 141 | historical LS190-named files only | Yes | No | Yes |
| A2U220-472051 | ED10 manual p.8 item 30; LS190-B2285 row 149; PO row 28 | LS190-B2285 row 149 | Yes | No | Yes |
| A2U900-255336 | ED10 manual p.275 item 17; LS190-B2285 row 257; PO row 38 | LS190-B2285 row 257 | Yes | No | Yes |
| A2U900-534055 | ED10 manual p.275 item 24; LS190-312 row 106; LS190-B2285 row 476; PO row 63 | workbook rows | Yes | No | Yes |
| A2U900-596146 | ED10 manual p.237 item 19; LS190-B2285 row 128; PO row 26 | LS190-B2285 row 128 | Yes | No | Yes |
| A2U900-694015 | ED10 manual p.61 item 3; LS190 workbooks rows 13/20/464/471; PO row 55 | workbook rows | Yes | No | Yes |
| A2U900-694075 | ED10 manual p.203 item 12; LS190 workbooks rows 18/94/189; PO row 33 | workbook rows | Yes | No | Yes |
| A2U900-694078 | ED10 manual p.203 item 7; LS190-B2285 rows 116/190; PO rows 25/34 | workbook rows | Yes | No | Yes |
| AFP1006-4 | ED10 manual p.18 item 18; LS190 workbooks rows 6/74/16/52; PO rows 12/16/20 | workbook rows | Yes | No | Yes |
| D2NP10-5541 | ED10 manual p.35 item 6; LS190-B2285 row 92; PO row 21 | LS190-B2285 row 92 | Yes | No | Yes |
| D2NP14-8343 | ED10 manual pp.24/57/67 items 8/16/13; LS190 workbooks rows 150/12/58/101; PO rows 11/17/22 | workbook rows | Yes | No | Yes |
| D2NP14-8345 | ED10 manual p.57 item 17; LS190-312 row 151; LS190-B2285 row 59; PO row 18 | workbook rows | Yes | No | Yes |
| D2NP14-8347 | ED10 manual p.57 item 5; LS190-312 row 152; LS190-B2285 row 60; PO row 19 | workbook rows | Yes | No | Yes |

The table deliberately does not elevate a relation because a copied summary mentions both device names or references an LS190-named file.

## 6. Relationship Provenance Statistics

`manual` means an explicit manual/schematic locator in the summary. `specific lexical` only means the model token occurs; it is shown to demonstrate why lexical matching is insufficient. `independent relationship provenance` means text distinct from the parent PN summary; it is absent in all rows.

| Metric | ACTIVE total | ED10 | LS190 |
|---|---:|---:|---:|
| Relations | 1,609 | 1,571 | 38 |
| Specific lexical model token | 1,608 | 1,571 | 37 |
| Manual/schematic locator | 1,585 | 1,568 | 17 |
| Direct fitment evidence before the PN identity gate | 1,591 | 1,571 | 20 |
| PO cited | 39 | 21 | 18 |
| Multiple independently named source files | 70 | 52 | 18 |
| Excel-row-only evidence | 0 | 0 | 0 |
| Summary exactly equals parent PN summary | 1,609 | 1,571 | 38 |
| Independently relationship-scoped provenance metadata | 0 | 0 | 0 |

The 18 LS190 relations not directly supported under the gate are the 17 multi-model LS190 records plus `A2U900-472057`. They are not asserted false; they are REVIEW until relationship provenance is normalized.

## 7. Part Number Evidence Classification

| Class | Count |
|---|---:|
| OFFICIAL | 1,568 |
| CORROBORATED | 21 |
| HISTORICAL_SINGLE | 0 |
| REVIEW | 3 |
| HOLD | 4 |

The 21 CORROBORATED PNs consist of `A2U900-472057` plus 20 V2.2 summaries which explicitly state two or more independent historical sources and PO/fitment corroboration. They are not reclassified OFFICIAL merely because a source file looks manufacturer-related.

## 8. Existing 160 Safety Assessment

Live PostgreSQL was not reachable from this checkout: the only active local `DATABASE_URL` is a SQLite placeholder while this project schema requires PostgreSQL. No DB query was attempted against any guessed endpoint.

Using the supplied prior reverse-audit facts only: 160 existing PN records and 162 relations are historical verified assets; 155 ED10 relations contain ED10 manual evidence and 7 LS190 relations contain LS190 evidence. Those facts support a provisional **160 OFFICIAL / 0 CORROBORATED / 0 REVIEW/HOLD** PN safety result, with **no immediate high-risk error identified**. This is not a fresh live-DB reconciliation and must be re-run against a supplied read-only PostgreSQL connection before changing production policy.

## 9. Remaining Dataset Assessment

The 160 production PN numbers were not available from a queryable database in this environment. The following is therefore a transparent contingent calculation, using the supplied statement that all 160 historical assets are supported official assets and do not overlap the 4 HOLD rows:

| Item | Count |
|---|---:|
| Full CSV | 1,596 |
| Less historical existing PN | -160 |
| Less HOLD PNs excluded from import | -4 |
| Remaining import candidates | **1,432** |
| OFFICIAL candidates | 1,408 |
| CORROBORATED candidates | 21 |
| REVIEW candidates | 3 |
| HOLD candidates (excluded) | 4 |

Do not treat 1,432 as a verified live-DB result until the 160 PN numbers are supplied by a SELECT-only query and set-difference is recomputed.

## 10. Asset Gate V1.0 Simulation

Format readiness is assumed only for the supplied V3 rows; it is not a trust result.

| Gate output | Part Numbers | Equipment relationships |
|---|---:|---:|
| AUTO_VERIFIED | 1,589 (OFFICIAL + CORROBORATED) | 1,588 |
| REVIEW | 3 | 21 |
| HOLD | 4 | 4 |

Relationship HOLD is the four `MODEL_PENDING` rows. Relationship REVIEW is the LS190 relation for each of the 17 multi-model PNs, the LS190 relation for `A2U900-472057`, and the ED10 relation for each PN-level REVIEW asset. The last three have fitment language but do not clear the preceding PN identity gate.

## 11. REVIEW List

PN REVIEW: `A2U130-694057`, `A2U220-267122`, `A2U900-472061`.

Relationship REVIEW: LS190 relation for `106-03455`, `114-8516LFL`, `915-26018`, `A2U130-194285`, `A2U220-267113`, `A2U220-472051`, `A2U900-255336`, `A2U900-534055`, `A2U900-596146`, `A2U900-694015`, `A2U900-694075`, `A2U900-694078`, `AFP1006-4`, `D2NP10-5541`, `D2NP14-8343`, `D2NP14-8345`, `D2NP14-8347`, and `A2U900-472057`; plus ED10 relation for `A2U130-694057`, `A2U220-267122`, and `A2U900-472061`.

## 12. HOLD List

| PN | Reason |
|---|---|
| A2U913-651005 | NOT_EXPLICIT; LOW; no confirmed model |
| A2U220-193386 | NOT_EXPLICIT; LOW; no confirmed model |
| A2U900-472060 | NOT_EXPLICIT; MEDIUM; no confirmed model |
| A2U900-472055 | NOT_EXPLICIT; MEDIUM; no confirmed model |

Their corresponding four CSV relations are MODEL_PENDING and remain HOLD.

## 13. Risks

1. Uniform CSV/database verification and publish flags can make format-ready records appear trust-ready.
2. PN-level evidence copied into relations can create unsupported equipment authority, especially across ED10 and LS190.
3. The 17 multi-model LS190 links are the immediate provenance-normalization priority.
4. Current local configuration does not permit a fresh production database safety reconciliation.

## 14. Recommended Gate Rules

1. Require independent PN identity evidence before asset verification.
2. Require model-specific evidence with a relation-level source locator before auto-verifying a PN × Equipment relation.
3. Treat each equipment identity separately; no ED10-to-LS190 inference.
4. Preserve original source, page/item/row, extraction context, and relation evidence separately from PN identity evidence.
5. Fail closed for missing model, NOT_EXPLICIT evidence, LOW confidence, and conflicts; route to HOLD/REVIEW rather than writing verified/ready values.

## 15. Recommended Next Implementation Step

Implement a preview-only provenance-normalization report first: produce a relation-level evidence record for each PN × Equipment link, then run the gate in dry-run mode. Supply a read-only PostgreSQL URL (or the 160 production PN-number export) before any production reconciliation. Do not alter the historical 160 assets as part of that work.

## 16. Pre-Audit Numerical Reconciliation

This section is a read-only self-audit of the preceding report. It reproduces the old importer's `norm()` rule exactly: trim, uppercase, then remove whitespace, `-`, `_`, `/`, `.`, `·`, ASCII/Chinese commas, ASCII/Chinese parentheses, and brackets. A normalized group is alias-held only when it contains more than one distinct original `part_number` value.

### 16.1 Importer-format arithmetic

| Metric | Result | Reproduction basis |
|---|---:|---|
| RAW_ROWS | 1,596 | CSV rows |
| NORMALIZED_GROUPS | 1,571 | importer `byNorm` keys |
| ALIAS_NORMALIZED_GROUPS | 25 | importer `aliasNormSet` |
| ALIAS_MEMBER_ROWS | 50 | rows whose normalized key is in `aliasNormSet` |
| FORMAT_READY_ROWS | 1,546 | `part_number` nonempty and not alias-held; all also pass the importer's required-field validation |
| Existing imported | 160 | supplied previous importer/production audit fact |
| RAW_REMAINING | 1,436 | 1,596 - 160; this is not importable count |
| FORMAT_READY_REMAINING | **1,386** | 1,546 - 160 |

`FORMAT_READY_ROWS` is intentionally the old importer's `SINGLE_READY` population, not a Trust Gate result. The importer creates its name from the PN when needed and its `toSlug` fallback succeeds; its only actual required CSV constraint after alias exclusion is a nonempty category, which all 1,546 rows satisfy.

### 16.2 Correction of the prior 1,432 value

**PREVIOUS_REMAINING_CALCULATION=INCORRECT**

The prior 1,432 was computed as `1,596 - 160 - 4 HOLD`. It removed the four Trust HOLD rows from RAW but omitted the 50 rows in the 25 importer alias-normalized groups. The old importer blocks those 50 rows before any trust decision. The correct format funnel is therefore `1,596 - 50 = 1,546`, then `1,546 - 160 = 1,386` remaining format-ready rows.

### 16.3 Strict evidence classification correction

The earlier `OFFICIAL=1,568` was not sufficiently strict. It used a text pattern matching `manual page` or `manual exact PN`, which admitted 23 rows without requiring both the user-confirmed official manual filename and a locatable manual page.

The following is the **historical audit implementation detail** used to calculate the corrected audit classes. It records that this audit matched the exact source identity after the user had independently confirmed that `伊泰LS190-ED10配件手册.pdf` is Sandvik official material; it is not a general production provenance rule.

The historical calculation evaluated rules in this order:

```text
HOLD          := model_evidence != "EXPLICIT" OR confidence == "LOW"
OFFICIAL      := NOT HOLD
                 AND source_files contains "伊泰LS190-ED10配件手册.pdf"
                 AND evidence_summary matches /(?i)(ED10|LS190) (parts )?manual page [0-9]+/
CORROBORATED  := NOT HOLD AND NOT OFFICIAL
                 AND distinct historical source-file tokens with an evidence row locator >= 2
REVIEW        := NOT HOLD AND NOT OFFICIAL AND NOT CORROBORATED
```

The source-token count is based only on named historical files that are also cited with a row locator in `evidence_summary`; `source_files` being nonempty alone does not qualify a record.

For production semantics, a filename match—whether exact or containing a manual name—is never provenance proof by itself and must not set `provenanceConfirmed=true` or produce OFFICIAL. This audit-specific classification depended on the independently confirmed provenance fact above plus a locatable claim. The Phase 1 audit provenance fixture remains test-only and must not become a production evidence normalizer. Future production evidence must use explicit normalized provenance/evidence facts rather than filename inference.

| Corrected class | Total | FORMAT_READY | Alias member rows |
|---|---:|---:|---:|
| OFFICIAL | 1,547 | 1,497 | 50 |
| CORROBORATED | 15 | 15 | 0 |
| REVIEW | 30 | 30 | 0 |
| HOLD | 4 | 4 | 0 |
| **TOTAL** | **1,596** | **1,546** | **50** |

`CLASSIFICATION_TOTAL=1596`\\
`CLASSIFICATION_OVERLAP=0`\\
`CLASSIFICATION_UNASSIGNED=0`

This confirms the classes are mutually exclusive and exhaustive. It also demonstrates the required ordering: 50 OFFICIAL rows are still not automatically importable because the format gate blocks their alias-normalized groups.

### 16.4 OFFICIAL=1,547 audit

| Metric | Count | Meaning |
|---|---:|---|
| OFFICIAL_TOTAL | 1,547 | strict corrected total |
| OFFICIAL_SOURCE_FILE_EXPLICIT | 1,547 | `source_files` names the user-confirmed manual |
| OFFICIAL_MANUAL_PAGE_ITEM | 1,545 | explicit manual page **and** item in evidence text |
| OFFICIAL_USER_CONFIRMED_MANUAL | 1,547 | overlap with source-file-explicit set; not additive |
| OFFICIAL_METADATA_INFERRED | 0 | no strict OFFICIAL result is metadata-only |
| OFFICIAL_OTHER | 2 | source-confirmed manual plus locatable page, but no `item` token |

The OFFICIAL subsets overlap and must not be added. The two `OFFICIAL_OTHER` PNs are `A2U900-694090` and `AFP1006-5`; both name the confirmed manual in `source_files` and cite manual pages, but their summaries do not state an item number.

There **were 23 rows** admitted by the earlier manual-string classification without satisfying the strict OFFICIAL rule. They were not silently retained:

- Reclassified CORROBORATED (14): `912-63008`, `AFP1009-3`, `A2U921-694008`, `AFP1007-12`, `A2U900-594589`, `A2U900-694062`, `A2U936-694025`, `A2U913-694007`, `A2U900-472047`, `A2U913-694052`, `A2U936-694048`, `918-2978402`, `016-63012`, `A2U900-592080`.
- Reclassified REVIEW due to a single historical row plus a manual assertion without source-file provenance: `A2U936-594165`, `A2U936-694027`, `A2U900-694095`, `A2U900-521049`, `A2U913-694056`, `A2U220-694096`, `A2U900-594356`.

The corrected CORROBORATED total is 15 because it also includes `A2U900-472057`, which was already classified CORROBORATED rather than a prior manual-string OFFICIAL. The bullets are not assertions that every cited file is official. The key correction is that a string such as `ED10 manual exact PN match found during V2.1 AI second-pass review` is no longer enough for OFFICIAL when the confirmed manual is absent from `source_files`.

### 16.5 Alias × Trust cross-check

All 50 alias member rows are strict OFFICIAL. This does **not** make them importable: the old importer holds every member of those 25 normalized collision groups at the format gate.

| Alias member class | Rows |
|---|---:|
| OFFICIAL | 50 |
| CORROBORATED | 0 |
| REVIEW | 0 |
| HOLD | 0 |

### 16.6 Five boundary PNs

| PN | FORMAT_STATUS | PN_EVIDENCE_CLASS | FITMENT_STATUS | PUBLISH_RECOMMENDATION |
|---|---|---|---|---|
| A2U913-651005 | FORMAT_READY | HOLD | MODEL_PENDING; NOT_EXPLICIT, no confirmed model | HOLD / do not publish |
| A2U220-193386 | FORMAT_READY | HOLD | MODEL_PENDING; NOT_EXPLICIT, no confirmed model | HOLD / do not publish |
| A2U900-472060 | FORMAT_READY | HOLD | MODEL_PENDING; NOT_EXPLICIT, no confirmed model | HOLD / do not publish |
| A2U900-472057 | FORMAT_READY | CORROBORATED | LS190 relation has historical row/PO support but no independent relationship provenance | REVIEW / no auto-publish |
| A2U900-472055 | FORMAT_READY | HOLD | MODEL_PENDING; NOT_EXPLICIT, no confirmed model | HOLD / do not publish |

### 16.7 Corrected final funnel

```text
RAW 1596
  -> FORMAT_HOLD 50 (25 normalized alias groups)
  -> FORMAT_READY 1546
       -> PN IDENTITY / FITMENT / PUBLISH classification:
          OFFICIAL 1497, CORROBORATED 15, REVIEW 30, HOLD 4
       -> EXISTING_IMPORTED 160 (known count, but individual PN membership unavailable)
       -> REMAINING_FORMAT_READY 1386
```

The importer facts prove that the 160 existing rows came from the `SINGLE_READY` population, so `REMAINING_FORMAT_READY=1386` is closed. However, the available evidence does **not** identify which of the corrected classes contain those 160 PN numbers. Consequently the exact remaining gate buckets cannot be derived without guessing:

```text
AUTO_VERIFIED_REMAINING = 1512 - existing(OFFICIAL or CORROBORATED)
REVIEW_REMAINING        = 30 - existing(REVIEW)
HOLD_REMAINING          = 4 - existing(HOLD)
sum                      = 1386
```

`TRUST_GATE_ELIGIBLE_REMAINING=BLOCKED_PENDING_EXISTING_160_PN_SET`

Therefore `AUTO_VERIFIED_REMAINING`, `REVIEW_REMAINING`, and `HOLD_REMAINING` are intentionally not assigned guessed integers. A read-only export of the 160 PN numbers (or a reachable read-only PostgreSQL query) is required to resolve the intersection and produce the requested exact post-existing class funnel. Until then:

`RECONCILIATION_STATUS=BLOCKED`

The numerical reconciliation is complete; the gate decision for the remaining 1,386 rows is blocked only on the missing historical-import membership set, not on any request for data mutation.

## 17. Final Production-Set Reconciliation

Audit basis: the user-provided production `EXISTING_IMPORTED_SET`, extracted by the stated read-only `PartNumber JOIN PartNumberAuditLog` filter (`IMPORT_CREATE`, reason `V3.1 verified Sandvik ED10/LS190 import`). This section uses that exact set; it does not infer existing records from sort order, CSV order, or the first 160 format-ready rows.

### 17.1 Existing-set validation

| Validation | Result |
|---|---:|
| EXISTING_SET_COUNT | 160 |
| EXISTING_SET_UNIQUE_COUNT | 160 |
| EXISTING_NOT_IN_V3 | 0 |
| EXISTING_IN_FORMAT_HOLD | 0 |
| EXISTING_VALID_FORMAT_READY | 160 |
| REMAINING_FORMAT_READY_SET | 1,386 |

The required validation is exactly `160 / 0 / 160`; the set is valid and the final difference set closes: `FORMAT_READY_SET (1546) - EXISTING_IMPORTED_SET (160) = 1386`. This supersedes the previous membership limitation in section 16, while retaining its explicit record that the earlier 1,432 calculation was incorrect.

### 17.2 Exact PN identity classification

The strict, machine-readable classification rules in section 16.3 were applied to the actual set membership. The four classes are mutually exclusive and complete within each set.

| Set | OFFICIAL | CORROBORATED | REVIEW | HOLD | Total |
|---|---:|---:|---:|---:|---:|
| Existing production (160) | 154 | 1 | 5 | 0 | 160 |
| Remaining format-ready (1,386) | 1,343 | 14 | 25 | 4 | 1,386 |

`EXISTING_OFFICIAL + EXISTING_CORROBORATED + EXISTING_REVIEW + EXISTING_HOLD = 160`\\
`REMAINING_OFFICIAL + REMAINING_CORROBORATED + REMAINING_REVIEW + REMAINING_HOLD = 1386`

Existing REVIEW list: `016-63028`, `4697280`, `4699377`, `55025218`, `56006630`.

Existing HOLD list: none.

The five existing REVIEW records were already imported under the legacy importer semantics and should be queued for manual provenance review. They are not evidence of a reason to roll back the entire 160-record historical batch. No existing record is strict HOLD.

Remaining REVIEW list: `A2U900-472061`, `BD00005741`, `A2U936-594165`, `BD00024890`, `BU00005478`, `BU00005521`, `BU00005523`, `A2U900-490053`, `BU00016457`, `BD00024891`, `A2U900-521064`, `A2U900-596148`, `A2U220-267122`, `A2U936-694027`, `A2U900-694059`, `A2U130-694057`, `BU00008111`, `A2U900-694095`, `A2U900-521049`, `BR00064923`, `BD00005952`, `BU00016861`, `A2U913-694056`, `A2U220-694096`, `A2U900-594356`.

Remaining HOLD list: `A2U913-651005`, `A2U220-193386`, `A2U900-472060`, `A2U900-472055`.

### 17.3 PN identity and equipment-fitment gates are separate

PN identity simulation for the remaining set:

| Outcome | Count |
|---|---:|
| PN_AUTO_VERIFIED (`OFFICIAL + CORROBORATED`) | 1,357 |
| PN_REVIEW | 25 |
| PN_HOLD | 4 |
| Total | 1,386 |

Fitment simulation covers relationship rows attached to the remaining format-ready PN set. It uses relationship CSV evidence, not importer-written `EXPLICIT` / `VERIFIED` flags. A relation is AUTO only when all conditions hold: relation is ACTIVE, model is present, PN identity is OFFICIAL or CORROBORATED, and the relation evidence has direct model support (ED10 manual-page evidence for ED10, or explicit LS190 fitment wording for LS190). MODEL_PENDING is separate and cannot enter AUTO.

| Relationship outcome | Count |
|---|---:|
| FITMENT_AUTO_VERIFIED | 1,343 |
| FITMENT_REVIEW | 54 |
| FITMENT_HOLD | 0 |
| FITMENT_MODEL_PENDING | 4 |
| Total relationship rows | 1,401 |

The relationship equation closes: `1343 + 54 + 0 + 4 = 1401`. The difference between 1,386 remaining PNs and 1,401 relation rows comes from multi-model PN relations. There are 1,328 remaining PNs whose complete relationship set clears both simulated gates; the other AUTO-identity PNs have at least one relation in REVIEW.

### 17.4 Multi-model reconciliation and provenance

| Metric | Result |
|---|---:|
| MULTI_MODEL_TOTAL | 17 |
| MULTI_MODEL_IN_EXISTING | 2 (`106-03455`, `114-8516LFL`) |
| MULTI_MODEL_IN_REMAINING | 15 |
| RELATION_PROVENANCE_INDEPENDENT (ACTIVE corpus) | 0 |
| RELATION_PROVENANCE_SHARED_OR_AMBIGUOUS (ACTIVE corpus) | 1,609 |

The 17-PN conclusion from section 5 is retained. In particular, copied PN-level text mentioning ED10 and LS190 does not independently verify both fitments. The remaining 15 multi-model PNs contribute an ED10-supported relation and an LS190 REVIEW relation unless independently normalized provenance is later supplied.

### 17.5 Final funnel and decision

```text
RAW                              1596
  -> FORMAT_HOLD                   50  (25 alias-normalized groups)
  -> FORMAT_READY                1546
       -> EXISTING_PRODUCTION      160
       -> REMAINING_FORMAT_READY  1386
            -> PN identity: AUTO 1357 / REVIEW 25 / HOLD 4
            -> fitment rows: AUTO 1343 / REVIEW 54 / HOLD 0 / MODEL_PENDING 4
            -> complete-PN auto-publish candidates: 1328
```

Final decisions:

1. The existing 160 do **not** require immediate rollback.
2. Five existing PNs require manual provenance review: `016-63028`, `4697280`, `4699377`, `55025218`, `56006630`.
3. Of the remaining format-ready PNs, 1,328 are complete simulated auto-publish candidates after both identity and all fitment relations clear; 25 are PN identity REVIEW, 4 are PN HOLD, and additional AUTO-identity PNs remain constrained by fitment REVIEW.
4. The exact relationship review queue is 54 rows; no relationship is in separate active HOLD, and 4 are MODEL_PENDING.
5. The evidence, format, set-difference, and provenance findings are sufficient to define Asset Gate V1.0 rules. They are not authorization to implement the gate, write VERIFIED/READY statuses, import data, or change the historical batch.

`LEGACY_160_ACTION=NO_IMMEDIATE_ROLLBACK; MANUAL_REVIEW_5`

The five REVIEW records belong in the future Legacy Verified Review Queue; they must not be automatically downgraded. The authoritative legacy classification is `EXISTING_OFFICIAL=154`, `EXISTING_CORROBORATED=1`, `EXISTING_REVIEW=5`, and `EXISTING_HOLD=0`, not the provisional `160 OFFICIAL` result retained earlier in this historical record.

`FINAL_RECONCILIATION_STATUS=COMPLETE`
