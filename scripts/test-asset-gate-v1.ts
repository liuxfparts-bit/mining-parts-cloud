import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateFormat,
  evaluatePartNumberAsset,
  buildDecisionManifest,
  calculateSourceFingerprint,
  calculateManifestFingerprint,
  summarizeManifestDecisions,
  serializeCanonicalJson,
  validateDecisionManifest,
  type AssetInput,
  type EvidenceFacts,
  type ManifestBuildInput,
  type ModelEvidence,
} from "../src/lib/trust/asset-gate";

const ROOT = process.cwd();
const PN_CSV = resolve(ROOT, "data/part-numbers/kuangpeiyun_partnumber_import_v3.csv");
const REL_CSV = resolve(ROOT, "data/part-numbers/kuangpeiyun_equipment_relations_v3.csv");

// Production read-only fixture supplied by the V3.1 IMPORT_CREATE audit; never infer from ordering.
const EXISTING_IMPORTED = new Set(["016-15015", "016-63012", "016-63028", "016-92009", "016-93020", "06575109", "06575111", "06575124", "06581411", "100202", "100485", "101552", "102010", "102314", "103-04399", "103805", "106-03455", "107263", "110237", "111097", "114-8516LFL", "114962", "115028", "117867", "117900", "14 14", "20A", "222325", "222411", "222412", "222413", "222742", "224771", "226270", "226271", "228655", "229917", "234221", "244526", "244676", "246362", "246631", "246633", "247065", "248872", "254058", "255305", "263083200", "28GF", "359-1003458", "359-450002", "445202801", "445202804", "445208600", "445208660", "445208662", "445208762", "445208770", "445208807", "445210937", "445250791", "445402816", "445402819", "445402820", "445402855", "445402859", "445402861", "445402863", "445402864", "445402939", "445402941", "445402950", "445402954", "445402963", "445403077", "445403089", "445405075", "445502656", "445502660", "445502751", "445502755", "445502759", "445502761", "445502764", "445502767", "445502795", "445502799", "445502801", "445502802", "445502806", "445502807", "445502808", "445502842", "445502843", "445502844", "445502845", "445502847", "445502848", "445502933", "445502935", "445502937", "445502939", "445503069", "445503070", "445503072", "445504761", "445504939", "445512804", "445520802", "4455405082", "450061615", "450061617", "450061619", "450061624", "450062506", "450062508", "450063010", "450065518", "450081022", "450081034", "450081116", "45008112", "450081120", "450081124", "450081130", "45502807", "455300044", "455302034", "455302036", "455302040", "455309026", "455309030", "455309034", "455309036", "455309040", "455669026", "455669030", "455669034", "455669036", "455669044", "4697280", "4699377", "49502843", "495502845", "500400", "5450081124", "55025218", "56006630", "64112654", "64113616", "64117540", "64119126", "64119919", "64253186", "64400345", "64400369", "64404002", "64404396", "64404408", "64544447"]);

type Row = Record<string, string>;
type AuditProvenanceFixture = Readonly<{
  sourceFile: string;
  provenanceConfirmed: true;
  description: string;
}>;

// Test-only audit fact: the pre-audit explicitly confirmed this exact source as
// a Sandvik official manual. This is not a production evidence normalizer and
// neither the gate engine nor arbitrary filenames receive this authority.
const AUDIT_PROVENANCE_FIXTURES: readonly AuditProvenanceFixture[] = [{
  sourceFile: "伊泰LS190-ED10配件手册.pdf",
  provenanceConfirmed: true,
  description: "Pre-audit user-confirmed Sandvik official ED10/LS190 manual",
}];
function parseCsv(text: string): Row[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { field += ch; i++; } else quoted = false; } else field += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((r) => r.some((cell) => cell.trim())).map((r) => Object.fromEntries(headers.map((header, i) => [header, (r[i] || "").trim()])));
}

function norm(value: string): string { return value.trim().toUpperCase().replace(/[\s\-_/.·,，()（）\[\]]/g, ""); }
function sourceCount(summary: string): number {
  const names = summary.match(/SANDVIK LS 190-312 PARTS20260228\.xlsx|SANDVIK LS190-B2285 SPARE PARTS LIST_Mining India_24\.03\.2026\.xlsx|LS 190-PO\.xlsx|LS_190_-REQUIREMENT20260107\.xlsx|Purchase Order-Shanxi\.xlsx|山特维克ls190-20260806\.xlsx|Sandvik LS190\.xls/gi) || [];
  return new Set(names.map((name) => name.toLowerCase())).size;
}
function auditConfirmedProvenance(row: Row): boolean {
  const declaredSources = (row.source_files || "").split(/\s*[;|]\s*/).map((source) => source.trim());
  return AUDIT_PROVENANCE_FIXTURES.some((fixture) => declaredSources.includes(fixture.sourceFile));
}
function hasManualLocator(summary: string): boolean {
  return /(ED10|LS190) (parts )?manual page \d+/i.test(summary);
}
function pnEvidenceFromAuditFixture(row: Row): EvidenceFacts {
  const summary = row.evidence_summary || "";
  return {
    provenanceConfirmed: auditConfirmedProvenance(row),
    locatableOfficialClaim: hasManualLocator(summary),
    independentHistoricalSources: sourceCount(summary),
    evidenceMissing: !summary,
  };
}
function relationshipEvidenceFromAuditFixture(relation: Row): EvidenceFacts {
  const summary = relation.evidence_summary || "";
  // The confirmed-manual fact is scoped to a relationship only when that
  // relationship has its own ED10 manual locator. PN-level source_files are
  // deliberately not read here.
  const hasConfirmedManualRelationship = relation.model === "ED10" && hasManualLocator(summary);
  return {
    provenanceConfirmed: hasConfirmedManualRelationship,
    locatableOfficialClaim: hasConfirmedManualRelationship,
    independentHistoricalSources: sourceCount(summary),
    evidenceMissing: !summary,
  };
}
function assertEqual(label: string, actual: number, expected: number, affected: string[] = []) {
  if (actual !== expected) throw new Error(`${label}: expected=${expected} actual=${actual}${affected.length ? ` affected=${affected.join(",")}` : ""}`);
}

const pnRows = parseCsv(readFileSync(PN_CSV, "utf8"));
const relationRows = parseCsv(readFileSync(REL_CSV, "utf8"));
const byNormalized = new Map<string, Set<string>>();
for (const row of pnRows) { const key = norm(row.part_number); const values = byNormalized.get(key) || new Set<string>(); values.add(row.part_number); byNormalized.set(key, values); }
const aliases = new Set(Array.from(byNormalized.entries()).filter(([, values]) => values.size > 1).map(([key]) => key));
const relationsByPn = new Map<string, Row[]>();
for (const relation of relationRows) { const list = relationsByPn.get(relation.part_number) || []; list.push(relation); relationsByPn.set(relation.part_number, list); }

function asInput(row: Row): AssetInput {
  const formatReadyFields = { number: Boolean(row.part_number), slug: Boolean(row.slug || row.part_number), name: Boolean(row.description || row.part_number), category: Boolean(row.category) };
  const relations = relationsByPn.get(row.part_number) || [];
  return {
    format: { partNumber: row.part_number, normalizedPartNumber: norm(row.part_number), slug: row.slug || row.part_number.toLowerCase(), requiredFields: formatReadyFields, aliasCollision: aliases.has(norm(row.part_number)) },
    pn: { evidence: pnEvidenceFromAuditFixture(row), modelEvidence: (row.model_evidence || "NOT_EXPLICIT") as ModelEvidence, confidence: (row.confidence || "MEDIUM") as any, legacyVerified: row.verification === "VERIFIED", legacyVerificationStatus: row.verification, legacyPublishStatus: row.import_status },
    fitments: relations.map((relation) => ({
      equipment: relation.model || "",
      confirmedModel: Boolean(row.confirmed_models),
      modelEvidence: (relation.model_evidence || "NOT_EXPLICIT") as ModelEvidence,
      relationStatus: relation.relation_status === "ACTIVE" ? "ACTIVE" : relation.relation_status === "MODEL_PENDING" ? "MODEL_PENDING" : "OTHER",
      evidence: relationshipEvidenceFromAuditFixture(relation),
      directModelSupport: relation.model === "ED10" ? /ED10 (parts )?manual page \d+/i.test(relation.evidence_summary || "") : relation.model === "LS190" ? /fitment to (Sandvik )?LS ?190/i.test(relation.evidence_summary || "") : false,
      legacyVerificationStatus: relation.verification,
      legacyEvidenceStatus: relation.model_evidence,
    })),
  };
}

/** Test adapter only: it supplies provenance references but never classifies evidence. */
function asManifestInput(row: Row): ManifestBuildInput {
  const relations = relationsByPn.get(row.part_number) || [];
  return {
    partNumber: row.part_number,
    gateInput: asInput(row),
    pnEvidenceReferences: (row.source_files || "").split(/\s*[;|]\s*/).filter(Boolean).map((reference) => ({ reference })),
    fitments: relations.map((relation) => ({ evidenceReferences: (relation.evidence_summary || "").split(/\s*;\s*/).filter(Boolean).map((reference) => ({ reference })) })),
  };
}

function manifestFixture(partNumber = "X"): ManifestBuildInput {
  return {
    partNumber,
    gateInput: {
      format: { partNumber, normalizedPartNumber: partNumber, slug: partNumber.toLowerCase(), requiredFields: { number: true, slug: true, name: true, category: true } },
      pn: { evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 0 }, modelEvidence: "EXPLICIT", confidence: "HIGH" },
      fitments: [
        { equipment: "LS190", confirmedModel: true, modelEvidence: "EXPLICIT", relationStatus: "ACTIVE", evidence: { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 0 }, directModelSupport: false },
        { equipment: "ED10", confirmedModel: true, modelEvidence: "EXPLICIT", relationStatus: "ACTIVE", evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 0 }, directModelSupport: true },
      ],
    },
    pnEvidenceReferences: [{ reference: "manual:pn:z" }, { reference: "manual:pn:a" }],
    fitments: [{ evidenceReferences: [{ reference: "relation:ls190:1" }] }, { evidenceReferences: [{ reference: "relation:ed10:1" }] }],
  };
}

function assertMalformedManifest(label: string, input: unknown) {
  let result: ReturnType<typeof validateDecisionManifest> | undefined;
  assert.doesNotThrow(() => { result = validateDecisionManifest(input); }, label);
  assert.ok(result, `${label}: validator returned no result`);
  assert.equal(result.valid, false, `${label}: malformed manifest must fail closed`);
  assert.ok(result.errors.length > 0, `${label}: malformed manifest must include a structured error`);
}

function count<T extends string>(items: T[]): Record<T, number> { return items.reduce((result, item) => ({ ...result, [item]: (result[item] || 0) + 1 }), {} as Record<T, number>); }
function test(name: string, fn: () => void) { fn(); console.log(`PASS ${name}`); }

test("format gate blocks all required failure modes", () => {
  const base = { partNumber: "A2U1", normalizedPartNumber: "A2U1", slug: "a2u1", requiredFields: { number: true, slug: true, name: true, category: true } };
  assert.equal(evaluateFormat({ ...base, partNumber: "" }).decision, "FORMAT_HOLD");
  assert.equal(evaluateFormat({ ...base, malformedPartNumber: true }).decision, "FORMAT_HOLD");
  assert.equal(evaluateFormat({ ...base, aliasCollision: true }).decision, "FORMAT_ALIAS_REVIEW");
  assert.equal(evaluateFormat({ ...base, normalizedCollision: true }).decision, "FORMAT_HOLD");
  assert.equal(evaluateFormat({ ...base, slugCollision: true }).decision, "FORMAT_HOLD");
  assert.equal(evaluateFormat({ ...base, requiredFields: { ...base.requiredFields, category: false } }).decision, "FORMAT_HOLD");
});

test("legacy flags and unconfirmed manual text cannot bypass the gate", () => {
  const result = evaluatePartNumberAsset({
    format: { partNumber: "X", normalizedPartNumber: "X", slug: "x", requiredFields: { number: true, slug: true, name: true, category: true } },
    pn: { evidence: { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 0 }, modelEvidence: "EXPLICIT", confidence: "HIGH", legacyVerified: true, legacyVerificationStatus: "VERIFIED", legacyPublishStatus: "READY" },
    fitments: [{ equipment: "ED10", confirmedModel: true, modelEvidence: "EXPLICIT", relationStatus: "ACTIVE", evidence: { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 0 }, directModelSupport: false, legacyVerificationStatus: "VERIFIED", legacyEvidenceStatus: "EXPLICIT" }],
  });
  assert.equal(result.evidenceClass, "INFERRED"); assert.equal(result.pnDecision.decision, "REVIEW"); assert.equal(result.fitments[0].decision.decision, "REVIEW"); assert.equal(result.publishDecision.decision, "BLOCKED");
});

test("official classification requires confirmed provenance and a locator", () => {
  const filenameOnly = evaluatePartNumberAsset({
    format: { partNumber: "X", normalizedPartNumber: "X", slug: "x", requiredFields: { number: true, slug: true, name: true, category: true } },
    pn: { evidence: { provenanceConfirmed: false, locatableOfficialClaim: true, independentHistoricalSources: 0 }, modelEvidence: "EXPLICIT", confidence: "HIGH" },
    fitments: [],
  });
  assert.notEqual(filenameOnly.evidenceClass, "OFFICIAL");
  const confirmed = evaluatePartNumberAsset({
    format: { partNumber: "Y", normalizedPartNumber: "Y", slug: "y", requiredFields: { number: true, slug: true, name: true, category: true } },
    pn: { evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 0 }, modelEvidence: "EXPLICIT", confidence: "HIGH" },
    fitments: [],
  });
  assert.equal(confirmed.evidenceClass, "OFFICIAL");
});

test("PN official evidence does not authorize every relationship", () => {
  const result = evaluatePartNumberAsset({
    format: { partNumber: "X", normalizedPartNumber: "X", slug: "x", requiredFields: { number: true, slug: true, name: true, category: true } },
    pn: { evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 0 }, modelEvidence: "EXPLICIT", confidence: "HIGH" },
    fitments: [{ equipment: "LS190", confirmedModel: true, modelEvidence: "EXPLICIT", relationStatus: "ACTIVE", evidence: { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 0 }, directModelSupport: false }],
  });
  assert.equal(result.evidenceClass, "OFFICIAL");
  assert.equal(result.fitments[0].evidenceClass, "INFERRED");
  assert.equal(result.fitments[0].decision.decision, "REVIEW");
});

test("boundary fixtures preserve pending and review outcomes", () => {
  for (const number of ["A2U913-651005", "A2U220-193386", "A2U900-472060", "A2U900-472055"]) {
    const result = evaluatePartNumberAsset(asInput(pnRows.find((row) => row.part_number === number)!));
    assert.equal(result.pnDecision.decision, "HOLD", number); assert.equal(result.fitments[0].decision.decision, "MODEL_PENDING", number);
  }
  const explicitMedium = evaluatePartNumberAsset(asInput(pnRows.find((row) => row.part_number === "A2U900-472057")!));
  assert.equal(explicitMedium.pnDecision.decision, "AUTO_VERIFIED"); assert.equal(explicitMedium.fitments[0].decision.decision, "REVIEW");
});

test("multi-model relationships are independent", () => {
  for (const number of ["106-03455", "114-8516LFL"]) {
    const result = evaluatePartNumberAsset(asInput(pnRows.find((row) => row.part_number === number)!));
    const byEquipment = Object.fromEntries(result.fitments.map((fitment) => [fitment.equipment, fitment.decision.decision]));
    assert.equal(byEquipment.ED10, "AUTO_VERIFIED", number); assert.equal(byEquipment.LS190, "REVIEW", number);
  }
});

test("conflict and missing evidence remain non-publishable", () => {
  const result = evaluatePartNumberAsset({
    format: { partNumber: "X", normalizedPartNumber: "X", slug: "x", requiredFields: { number: true, slug: true, name: true, category: true } },
    pn: { evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 2, hasConflict: true }, modelEvidence: "EXPLICIT", confidence: "HIGH" },
    fitments: [{ equipment: "ED10", confirmedModel: true, modelEvidence: "EXPLICIT", relationStatus: "ACTIVE", evidence: { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 2, evidenceMissing: true }, directModelSupport: false }],
  });
  assert.equal(result.pnDecision.decision, "HOLD"); assert.equal(result.publishDecision.decision, "BLOCKED");
});

test("manifest canonicalization is deterministic and preserves relationship evidence scope", () => {
  const first = manifestFixture("Z-2");
  const second = manifestFixture("A-1");
  const normal = buildDecisionManifest([first, second]);
  const reordered = buildDecisionManifest([
    { ...second, fitments: [...second.fitments!].reverse(), gateInput: { ...second.gateInput, fitments: [...second.gateInput.fitments].reverse() }, pnEvidenceReferences: [...second.pnEvidenceReferences!].reverse() },
    first,
  ]);
  assert.equal(normal.canonicalJson, reordered.canonicalJson);
  assert.equal(normal.manifest.sourceFingerprint, reordered.manifest.sourceFingerprint);
  assert.equal(normal.manifestFingerprint, reordered.manifestFingerprint);
  assert.equal(normal.manifest.partNumbers[0].partNumber, "A-1");
  assert.deepEqual(normal.manifest.partNumbers[0].fitments.map((fitment) => fitment.equipment), ["ED10", "LS190"]);
  assert.equal(normal.manifest.partNumbers[0].pnEvidenceClass, "OFFICIAL");
  assert.equal(normal.manifest.partNumbers[0].fitments.find((fitment) => fitment.equipment === "LS190")!.evidenceClass, "INFERRED");
  assert.equal(normal.manifest.partNumbers[0].fitments.find((fitment) => fitment.equipment === "LS190")!.fitmentDecision, "REVIEW");
  assert.equal(validateDecisionManifest(normal).valid, true);
});

test("manifest fingerprints and validator detect tampering", () => {
  const artifact = buildDecisionManifest([manifestFixture()]);
  const changedInput = manifestFixture();
  changedInput.gateInput.pn.evidence.locatableOfficialClaim = false;
  assert.notEqual(calculateSourceFingerprint([manifestFixture()]), calculateSourceFingerprint([changedInput]));
  assert.notEqual(artifact.manifestFingerprint, buildDecisionManifest([changedInput]).manifestFingerprint);
  const tamperedDecision = structuredClone(artifact);
  tamperedDecision.manifest.partNumbers[0].pnDecision = "REVIEW";
  assert.equal(validateDecisionManifest(tamperedDecision).valid, false);
  const tamperedSummary = structuredClone(artifact);
  tamperedSummary.manifest.summary.publishReady = 99;
  assert.equal(validateDecisionManifest(tamperedSummary).valid, false);
  const duplicatePn = structuredClone(artifact);
  duplicatePn.manifest.partNumbers.push(structuredClone(duplicatePn.manifest.partNumbers[0]));
  assert.equal(validateDecisionManifest(duplicatePn).errors.some((item) => item.code === "MANIFEST_PART_NUMBER_DUPLICATE"), true);
  const duplicateFitment = structuredClone(artifact);
  duplicateFitment.manifest.partNumbers[0].fitments.push(structuredClone(duplicateFitment.manifest.partNumbers[0].fitments[0]));
  assert.equal(validateDecisionManifest(duplicateFitment).errors.some((item) => item.code === "MANIFEST_FITMENT_DUPLICATE"), true);
  const unsupportedVersion = structuredClone(artifact);
  unsupportedVersion.manifest.schemaVersion = "9.9" as any;
  assert.equal(validateDecisionManifest(unsupportedVersion).errors.some((item) => item.code === "MANIFEST_SCHEMA_VERSION_UNSUPPORTED"), true);
  const unsupportedGate = structuredClone(artifact);
  unsupportedGate.manifest.gateVersion = "V9.9" as any;
  assert.equal(validateDecisionManifest(unsupportedGate).errors.some((item) => item.code === "MANIFEST_GATE_VERSION_UNSUPPORTED"), true);
  const invalidReason = structuredClone(artifact);
  invalidReason.manifest.partNumbers[0].pnReasonCode = "PN_NOT_A_REAL_REASON" as any;
  assert.equal(validateDecisionManifest(invalidReason).errors.some((item) => item.code === "MANIFEST_REASON_CODE_INVALID"), true);
  const invalidEnum = structuredClone(artifact);
  invalidEnum.manifest.partNumbers[0].pnEvidenceClass = "UNSUPPORTED" as any;
  assert.equal(validateDecisionManifest(invalidEnum).errors.some((item) => item.code === "MANIFEST_ENUM_INVALID"), true);
});

test("manifest validator fails closed for malformed JSON-compatible input", () => {
  const valid = buildDecisionManifest([manifestFixture()]);
  const missingPartNumbers = structuredClone(valid) as any; delete missingPartNumbers.manifest.partNumbers;
  const missingPartNumber = structuredClone(valid) as any; delete missingPartNumber.manifest.partNumbers[0].partNumber;
  const missingFitments = structuredClone(valid) as any; delete missingFitments.manifest.partNumbers[0].fitments;
  const missingEquipment = structuredClone(valid) as any; delete missingEquipment.manifest.partNumbers[0].fitments[0].equipment;
  const missingSummary = structuredClone(valid) as any; delete missingSummary.manifest.summary;
  const invalidDecisionType = structuredClone(valid) as any; invalidDecisionType.manifest.partNumbers[0].pnDecision = 7;
  const malformedFingerprint = structuredClone(valid) as any; malformedFingerprint.manifestFingerprint = "not-a-sha256";
  const cases: [string, unknown][] = [
    ["null", null], ["array", []], ["string", "manifest"], ["empty object", {}], ["manifest empty object", { manifest: {} }],
    ["partNumbers missing", missingPartNumbers], ["partNumbers null", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: null } }], ["partNumbers object", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: {} } }],
    ["partNumbers null entry", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: [null] } }], ["partNumbers primitive entry", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: ["pn"] } }],
    ["partNumber missing identity", missingPartNumber], ["fitments missing", missingFitments], ["fitments null", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: [{ ...structuredClone(valid.manifest.partNumbers[0]), fitments: null }] } }],
    ["fitments object", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: [{ ...structuredClone(valid.manifest.partNumbers[0]), fitments: {} }] } }], ["fitment null entry", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: [{ ...structuredClone(valid.manifest.partNumbers[0]), fitments: [null] }] } }],
    ["fitment primitive entry", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), partNumbers: [{ ...structuredClone(valid.manifest.partNumbers[0]), fitments: ["fitment"] }] } }], ["fitment missing equipment", missingEquipment],
    ["summary missing", missingSummary], ["summary malformed", { ...structuredClone(valid), manifest: { ...structuredClone(valid.manifest), summary: {} } }], ["decision wrong primitive", invalidDecisionType], ["fingerprint malformed", malformedFingerprint],
  ];
  for (const [label, input] of cases) assertMalformedManifest(label, input);
});

function resealManifest(artifact: ReturnType<typeof buildDecisionManifest>) {
  artifact.manifest.summary = summarizeManifestDecisions(artifact.manifest.partNumbers);
  artifact.canonicalJson = serializeCanonicalJson(artifact.manifest);
  artifact.manifestFingerprint = calculateManifestFingerprint(artifact.manifest);
  return artifact;
}

test("builder binds PN identity before evaluating Gate facts", () => {
  const matching = manifestFixture("A");
  assert.equal(validateDecisionManifest(buildDecisionManifest([matching])).valid, true);
  const mismatch = manifestFixture("A");
  mismatch.partNumber = "B";
  assert.throws(() => buildDecisionManifest([mismatch]), /PN identity must match/);
  const whitespaceMismatch = manifestFixture("A");
  whitespaceMismatch.partNumber = " A";
  assert.throws(() => buildDecisionManifest([whitespaceMismatch]), /PN identity must match/);
  const metadataMismatch = manifestFixture("A");
  metadataMismatch.fitments = [];
  assert.throws(() => buildDecisionManifest([metadataMismatch]), /metadata count mismatch/);
  const duplicateEquipment = manifestFixture("A");
  duplicateEquipment.gateInput.fitments[1].equipment = "LS190";
  assert.throws(() => buildDecisionManifest([duplicateEquipment]), /Duplicate fitment equipment/);
});

test("decision consistency retains the Phase 1 output matrix and priority", () => {
  const evidence: EvidenceFacts[] = [
    { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 0 },
    { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 2 },
    { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 1 },
    { provenanceConfirmed: false, locatableOfficialClaim: false, independentHistoricalSources: 0 },
    { provenanceConfirmed: true, locatableOfficialClaim: true, independentHistoricalSources: 2, hasConflict: true },
  ];
  const formatVariants: Partial<AssetInput["format"]>[] = [
    {}, { malformedPartNumber: true }, { normalizedPartNumber: "" }, { aliasCollision: true },
    { normalizedCollision: true }, { slugCollision: true },
    { requiredFields: { number: true, slug: true, name: true, category: false } },
  ];
  const inputs: ManifestBuildInput[] = [];
  for (const pnEvidence of evidence) for (const modelEvidence of ["EXPLICIT", "NOT_EXPLICIT"] as const) for (const confidence of ["HIGH", "LOW"] as const) {
    for (const relationEvidence of evidence) for (const mode of ["explicit", "pending", "unsupported", "missing"] as const) {
      const input = manifestFixture(`MATRIX-${inputs.length}`);
      input.gateInput.pn = { evidence: pnEvidence, modelEvidence, confidence };
      input.gateInput.fitments = [{ ...input.gateInput.fitments[1], evidence: relationEvidence,
        equipment: mode === "pending" ? "" : "ED10", confirmedModel: mode !== "pending",
        relationStatus: mode === "pending" ? "MODEL_PENDING" : "ACTIVE",
        directModelSupport: mode !== "unsupported" }];
      if (mode === "missing") input.gateInput.fitments[0].evidence = { ...relationEvidence, evidenceMissing: true };
      input.fitments = [{ evidenceReferences: [] }];
      inputs.push(input);
    }
  }
  for (const format of formatVariants) {
    const input = manifestFixture(`MATRIX-${inputs.length}`);
    Object.assign(input.gateInput.format, format);
    inputs.push(input);
  }
  const conflict = manifestFixture(`MATRIX-${inputs.length}`);
  conflict.gateInput.unresolvedConflict = true;
  inputs.push(conflict);
  const noFitments = manifestFixture(`MATRIX-${inputs.length}`);
  noFitments.gateInput.fitments = []; noFitments.fitments = [];
  inputs.push(noFitments);
  const manifest = buildDecisionManifest(inputs);
  assert.equal(validateDecisionManifest(manifest).valid, true);
  const pnReasons = new Set(manifest.manifest.partNumbers.map((item) => item.pnReasonCode));
  for (const reason of ["PN_EVIDENCE_CONFLICT", "PN_MODEL_EVIDENCE_NOT_EXPLICIT", "PN_CONFIDENCE_LOW", "PN_OFFICIAL_EVIDENCE_CONFIRMED", "PN_CORROBORATED_EVIDENCE_CONFIRMED", "PN_HISTORICAL_SINGLE_REVIEW", "PN_EVIDENCE_INFERRED_REVIEW"] as const) assert.ok(pnReasons.has(reason), reason);
  const fitmentReasons = new Set(manifest.manifest.partNumbers.flatMap((item) => item.fitments.map((fitment) => fitment.reasonCode)));
  for (const reason of ["FITMENT_MODEL_PENDING", "FITMENT_EVIDENCE_CONFLICT", "FITMENT_PN_NOT_AUTO_VERIFIED", "FITMENT_PROVENANCE_INSUFFICIENT", "FITMENT_EXPLICIT_PROVENANCE_CONFIRMED"] as const) assert.ok(fitmentReasons.has(reason), reason);
  assert.ok(manifest.manifest.partNumbers.some((item) => item.fitments.some((fitment) => fitment.evidenceClass === "HISTORICAL_SINGLE" && fitment.fitmentDecision === "AUTO_VERIFIED")));
  assert.ok(manifest.manifest.partNumbers.some((item) => item.publishReasonCode === "PUBLISH_UNRESOLVED_CONFLICT"));
  assert.equal(buildDecisionManifest([noFitments]).manifest.partNumbers[0].publishReasonCode, "PUBLISH_FITMENT_NOT_AUTO_VERIFIED");
});

test("validator rejects rehashed illegal decisions rather than relying on hash failure", () => {
  const input = manifestFixture("CONSISTENCY");
  input.gateInput.fitments = [input.gateInput.fitments[1]];
  input.fitments = [{ evidenceReferences: [] }];
  const baseline = buildDecisionManifest([input]);
  const cases: [string, (item: typeof baseline.manifest.partNumbers[number]) => void][] = [
    ["READY without fitments", (item) => { item.fitments = []; }],
    ["INFERRED PN AUTO", (item) => { item.pnEvidenceClass = "INFERRED"; }],
    ["CONFLICTED PN AUTO", (item) => { item.pnEvidenceClass = "CONFLICTED"; }],
    ["mismatched PN reason", (item) => { item.pnReasonCode = "PN_CORROBORATED_EVIDENCE_CONFIRMED"; }],
    ["cross-domain format reason", (item) => { item.formatReasonCode = "PN_OFFICIAL_EVIDENCE_CONFIRMED"; }],
    ["wrong format decision", (item) => { item.formatDecision = "FORMAT_HOLD"; }],
    ["AUTO fitment pending reason", (item) => { item.fitments[0].reasonCode = "FITMENT_MODEL_PENDING"; }],
    ["INFERRED fitment AUTO", (item) => { item.fitments[0].evidenceClass = "INFERRED"; }],
    ["CONFLICTED fitment AUTO", (item) => { item.fitments[0].evidenceClass = "CONFLICTED"; }],
    ["PN REVIEW with AUTO fitment", (item) => { item.pnEvidenceClass = "HISTORICAL_SINGLE"; item.pnDecision = "REVIEW"; item.pnReasonCode = "PN_HISTORICAL_SINGLE_REVIEW"; item.publishDecision = "BLOCKED"; item.publishReasonCode = "PUBLISH_PN_NOT_AUTO_VERIFIED"; }],
    ["fitment REVIEW with wrong priority reason", (item) => { item.fitments[0].fitmentDecision = "REVIEW"; item.fitments[0].reasonCode = "FITMENT_PN_NOT_AUTO_VERIFIED"; item.publishDecision = "BLOCKED"; item.publishReasonCode = "PUBLISH_FITMENT_NOT_AUTO_VERIFIED"; }],
    ["multi-model READY despite REVIEW", (item) => { item.fitments.push({ ...item.fitments[0], equipment: "LS190", fitmentDecision: "REVIEW", reasonCode: "FITMENT_PROVENANCE_INSUFFICIENT" }); }],
    ["publish reason mismatch", (item) => { item.publishReasonCode = "PUBLISH_FITMENT_NOT_AUTO_VERIFIED"; }],
    ["false blocked with all gates passing", (item) => { item.publishDecision = "BLOCKED"; }],
    ["conflict reason violates format priority", (item) => { item.formatDecision = "FORMAT_HOLD"; item.formatReasonCode = "FORMAT_PART_NUMBER_MALFORMED"; item.publishDecision = "BLOCKED"; item.publishReasonCode = "PUBLISH_UNRESOLVED_CONFLICT"; }],
    ["conflict reason violates PN priority", (item) => { item.pnDecision = "HOLD"; item.pnReasonCode = "PN_CONFIDENCE_LOW"; item.publishDecision = "BLOCKED"; item.publishReasonCode = "PUBLISH_UNRESOLVED_CONFLICT"; }],
  ];
  for (const [label, mutate] of cases) {
    const malformed = structuredClone(baseline); mutate(malformed.manifest.partNumbers[0]); resealManifest(malformed);
    assertMalformedManifest(label, malformed);
    assert.ok(validateDecisionManifest(malformed).errors.some((error) => error.code === "MANIFEST_DECISION_INCONSISTENT"), label);
  }
});

test("canonical envelope must contain exactly the serialized payload", () => {
  const valid = buildDecisionManifest([manifestFixture()]);
  const missing = structuredClone(valid) as any; delete missing.canonicalJson;
  const cases: [string, unknown][] = [
    ["missing canonicalJson", missing], ["null canonicalJson", { ...valid, canonicalJson: null }],
    ["numeric canonicalJson", { ...valid, canonicalJson: 7 }], ["object canonicalJson", { ...valid, canonicalJson: {} }],
    ["replaced canonicalJson", { ...valid, canonicalJson: '{"partNumbers":[]}' }],
    ["noncanonical envelope", { ...valid, canonicalJson: JSON.stringify(valid.manifest) }],
    ["extra bytes in envelope", { ...valid, canonicalJson: valid.canonicalJson + " " }],
  ];
  for (const [label, value] of cases) {
    assertMalformedManifest(label, value);
    assert.ok(validateDecisionManifest(value).errors.some((error) => error.code === "MANIFEST_CANONICAL_JSON_INVALID"), label);
  }
  const badSource = structuredClone(valid); badSource.manifest.sourceFingerprint = "not-sha256"; resealManifest(badSource);
  assert.ok(validateDecisionManifest(badSource).errors.some((error) => error.code === "MANIFEST_SOURCE_FINGERPRINT_INVALID"));
  const badFingerprint = { ...valid, manifestFingerprint: "0".repeat(64) };
  assert.ok(validateDecisionManifest(badFingerprint).errors.some((error) => error.code === "MANIFEST_FINGERPRINT_INVALID"));
});

test("validator fails closed for every unsupported field and hostile container", () => {
  const valid = buildDecisionManifest([manifestFixture()]);
  const cases: [string, unknown][] = [];
  for (const [label, value] of [["undefined", undefined], ["function", () => 1], ["bigint", BigInt(1)], ["symbol", Symbol("bad")], ["NaN", NaN], ["Infinity", Infinity]] as [string, unknown][]) {
    cases.push([`top-level ${label}`, value]);
    const extra = structuredClone(valid) as any; extra.manifest.unexpected = value;
    cases.push([`extra ${label}`, extra]);
    const nested = structuredClone(valid) as any; nested.manifest.partNumbers[0].pnEvidenceReferences[0] = { reference: "source", unexpected: { value } };
    cases.push([`nested ${label}`, nested]);
  }
  const cyclic = structuredClone(valid) as any; cyclic.manifest.loop = cyclic.manifest; cases.push(["cycle", cyclic]);
  const sparse = structuredClone(valid); sparse.manifest.partNumbers = new Array(1); cases.push(["sparse array", sparse]);
  const extraArrayField = structuredClone(valid) as any; extraArrayField.manifest.partNumbers.extra = undefined; cases.push(["array extra property", extraArrayField]);
  const symbolField = structuredClone(valid) as any; symbolField.manifest[Symbol("field")] = "value"; cases.push(["symbol property", symbolField]);
  const hidden = structuredClone(valid); Object.defineProperty(hidden.manifest, "hidden", { value: undefined }); cases.push(["nonenumerable property", hidden]);
  let getterCalled = false;
  const getter = structuredClone(valid); Object.defineProperty(getter.manifest, "unexpected", { enumerable: true, get() { getterCalled = true; throw new Error("getter"); } }); cases.push(["accessor", getter]);
  const proxy = new Proxy(valid, { ownKeys() { throw new Error("proxy"); } }); cases.push(["throwing proxy", proxy]);
  cases.push(["Date", { ...valid, manifest: { ...valid.manifest, unexpected: new Date(0) } }]);
  cases.push(["Map", { ...valid, manifest: { ...valid.manifest, unexpected: new Map() } }]);
  let deep: any = {}; for (let i = 0; i < 140; i++) deep = { nested: deep };
  cases.push(["excessive depth", { ...valid, manifest: { ...valid.manifest, unexpected: deep } }]);
  for (const [label, value] of cases) assertMalformedManifest(label, value);
  assert.equal(getterCalled, false);
  // Shared references are not cycles and must preserve a legal artifact.
  const shared = structuredClone(valid); const reference = { reference: "shared:source:locator" };
  shared.manifest.partNumbers[0].pnEvidenceReferences = [reference];
  shared.manifest.partNumbers[0].fitments[0].evidenceReferences = [reference];
  resealManifest(shared);
  assert.equal(validateDecisionManifest(shared).valid, true);
});

test("closed Manifest schema rejects rehashed unknown JSON fields at every level", () => {
  const valid = buildDecisionManifest([manifestFixture()]);
  const targets: [string, (artifact: typeof valid) => Record<string, unknown>][] = [
    ["envelope", (artifact) => artifact as unknown as Record<string, unknown>],
    ["manifest", (artifact) => artifact.manifest as unknown as Record<string, unknown>],
    ["summary", (artifact) => artifact.manifest.summary as unknown as Record<string, unknown>],
    ["PN", (artifact) => artifact.manifest.partNumbers[0] as unknown as Record<string, unknown>],
    ["fitment", (artifact) => artifact.manifest.partNumbers[0].fitments[0] as unknown as Record<string, unknown>],
    ["PN reference", (artifact) => artifact.manifest.partNumbers[0].pnEvidenceReferences[0] as unknown as Record<string, unknown>],
    ["relationship reference", (artifact) => artifact.manifest.partNumbers[0].fitments[0].evidenceReferences[0] as unknown as Record<string, unknown>],
  ];
  for (const [label, target] of targets) for (const value of [null, true, 7, "unknown", [], {}]) {
    const malformed = structuredClone(valid); target(malformed).unexpected = value;
    // Preserve the unknown summary field; only rehash the submitted payload.
    malformed.canonicalJson = serializeCanonicalJson(malformed.manifest);
    malformed.manifestFingerprint = calculateManifestFingerprint(malformed.manifest);
    assertMalformedManifest(`${label} unknown JSON field`, malformed);
    assert.ok(validateDecisionManifest(malformed).errors.some((error) => error.code === "MANIFEST_UNEXPECTED_FIELD"), label);
  }
});

test("empty equipment is valid only for MODEL_PENDING with its matching reason", () => {
  const input = manifestFixture("PENDING");
  input.gateInput.fitments = [{ ...input.gateInput.fitments[0], equipment: "", confirmedModel: false, modelEvidence: "NOT_EXPLICIT", relationStatus: "MODEL_PENDING" }];
  input.fitments = [{ evidenceReferences: [{ reference: "pending:source:row" }] }];
  const valid = buildDecisionManifest([input]);
  assert.equal(valid.manifest.partNumbers[0].fitments[0].equipment, "");
  assert.equal(valid.manifest.partNumbers[0].fitments[0].fitmentDecision, "MODEL_PENDING");
  assert.equal(valid.manifest.partNumbers[0].fitments[0].reasonCode, "FITMENT_MODEL_PENDING");
  assert.equal(validateDecisionManifest(valid).valid, true);
  const cases: [string, Record<string, unknown>][] = [
    ["empty AUTO_VERIFIED", { fitmentDecision: "AUTO_VERIFIED", reasonCode: "FITMENT_EXPLICIT_PROVENANCE_CONFIRMED" }],
    ["empty REVIEW", { fitmentDecision: "REVIEW", reasonCode: "FITMENT_PROVENANCE_INSUFFICIENT" }],
    ["empty HOLD", { fitmentDecision: "HOLD", reasonCode: "FITMENT_EVIDENCE_CONFLICT" }],
    ["empty unsupported decision", { fitmentDecision: "UNSUPPORTED" }],
    ["empty invalid reason", { reasonCode: "FITMENT_INVALID_REASON" }],
    ["empty mismatched reason", { reasonCode: "FITMENT_PROVENANCE_INSUFFICIENT" }],
    ["null equipment", { equipment: null }],
    ["numeric equipment", { equipment: 7 }],
    ["object equipment", { equipment: {} }],
  ];
  for (const [label, fields] of cases) {
    const malformed = structuredClone(valid);
    Object.assign(malformed.manifest.partNumbers[0].fitments[0], fields);
    // Rehash so a fingerprint mismatch cannot mask an invalid structure.
    malformed.canonicalJson = serializeCanonicalJson(malformed.manifest);
    malformed.manifestFingerprint = calculateManifestFingerprint(malformed.manifest);
    assertMalformedManifest(label, malformed);
    assert.equal(validateDecisionManifest(malformed).errors.some((error) => error.code === "MANIFEST_FITMENT_ENTRY_INVALID"), true, label);
  }
  const missingEquipment = structuredClone(valid) as any;
  delete missingEquipment.manifest.partNumbers[0].fitments[0].equipment;
  missingEquipment.canonicalJson = serializeCanonicalJson(missingEquipment.manifest);
  missingEquipment.manifestFingerprint = calculateManifestFingerprint(missingEquipment.manifest);
  assertMalformedManifest("pending missing equipment", missingEquipment);
});

test("manifest retains MODEL_PENDING and independent multi-model decisions", () => {
  for (const number of ["A2U913-651005", "A2U220-193386", "A2U900-472060", "A2U900-472055"]) {
    const manifest = buildDecisionManifest([asManifestInput(pnRows.find((row) => row.part_number === number)!)]).manifest;
    assert.equal(manifest.partNumbers[0].fitments[0].fitmentDecision, "MODEL_PENDING", number);
  }
  const explicit = buildDecisionManifest([asManifestInput(pnRows.find((row) => row.part_number === "A2U900-472057")!)]).manifest;
  assert.equal(explicit.partNumbers[0].fitments[0].equipment, "LS190");
  assert.notEqual(explicit.partNumbers[0].fitments[0].fitmentDecision, "MODEL_PENDING");
  for (const number of ["106-03455", "114-8516LFL"]) {
    const manifest = buildDecisionManifest([asManifestInput(pnRows.find((row) => row.part_number === number)!)]).manifest;
    const decisions = Object.fromEntries(manifest.partNumbers[0].fitments.map((fitment) => [fitment.equipment, fitment.fitmentDecision]));
    assert.equal(decisions.ED10, "AUTO_VERIFIED", number); assert.equal(decisions.LS190, "REVIEW", number);
  }
});

test("full-dataset and legacy baselines", () => {
  assertEqual("RAW", pnRows.length, 1596);
  assertEqual("FORMAT_HOLD", pnRows.filter((row) => aliases.has(norm(row.part_number))).length, 50);
  const formatReady = pnRows.filter((row) => evaluatePartNumberAsset(asInput(row)).formatDecision.decision === "FORMAT_READY");
  assertEqual("FORMAT_READY", formatReady.length, 1546);
  assertEqual("EXISTING", EXISTING_IMPORTED.size, 160);
  const existing = formatReady.filter((row) => EXISTING_IMPORTED.has(row.part_number));
  const remaining = formatReady.filter((row) => !EXISTING_IMPORTED.has(row.part_number));
  assertEqual("REMAINING_FORMAT_READY", remaining.length, 1386);
  const existingResults = existing.map((row) => ({ number: row.part_number, result: evaluatePartNumberAsset(asInput(row)) }));
  const legacy = count(existingResults.map(({ result }) => result.evidenceClass === "OFFICIAL" ? "OFFICIAL" : result.evidenceClass === "CORROBORATED" ? "CORROBORATED" : result.pnDecision.decision === "HOLD" ? "HOLD" : "REVIEW"));
  assertEqual("LEGACY_OFFICIAL", legacy.OFFICIAL || 0, 154); assertEqual("LEGACY_CORROBORATED", legacy.CORROBORATED || 0, 1); assertEqual("LEGACY_REVIEW", legacy.REVIEW || 0, 5); assertEqual("LEGACY_HOLD", legacy.HOLD || 0, 0);
  const legacyManifest = buildDecisionManifest(existing.map(asManifestInput));
  assert.equal(validateDecisionManifest(legacyManifest).valid, true);
  const manifestLegacy = count(legacyManifest.manifest.partNumbers.map((item) => item.pnEvidenceClass === "OFFICIAL" ? "OFFICIAL" : item.pnEvidenceClass === "CORROBORATED" ? "CORROBORATED" : item.pnDecision === "HOLD" ? "HOLD" : "REVIEW"));
  assertEqual("MANIFEST_LEGACY_OFFICIAL", manifestLegacy.OFFICIAL || 0, 154); assertEqual("MANIFEST_LEGACY_CORROBORATED", manifestLegacy.CORROBORATED || 0, 1); assertEqual("MANIFEST_LEGACY_REVIEW", manifestLegacy.REVIEW || 0, 5); assertEqual("MANIFEST_LEGACY_HOLD", manifestLegacy.HOLD || 0, 0);
  const results = remaining.map((row) => ({ number: row.part_number, result: evaluatePartNumberAsset(asInput(row)) }));
  const pn = count(results.map(({ result }) => result.pnDecision.decision));
  assertEqual("REMAINING_PN_AUTO", pn.AUTO_VERIFIED || 0, 1357); assertEqual("REMAINING_PN_REVIEW", pn.REVIEW || 0, 25); assertEqual("REMAINING_PN_HOLD", pn.HOLD || 0, 4);
  const fitments = results.flatMap(({ number, result }) => result.fitments.map((fitment) => ({ number, decision: fitment.decision.decision })));
  const fit = count(fitments.map((fitment) => fitment.decision));
  assertEqual("FITMENT_AUTO", fit.AUTO_VERIFIED || 0, 1343); assertEqual("FITMENT_REVIEW", fit.REVIEW || 0, 54); assertEqual("FITMENT_HOLD", fit.HOLD || 0, 0); assertEqual("FITMENT_PENDING", fit.MODEL_PENDING || 0, 4);
  const complete = results.filter(({ result }) => result.publishDecision.decision === "READY").map(({ number }) => number);
  assertEqual("COMPLETE_AUTO_CANDIDATES", complete.length, 1328, complete);
  const manifest = buildDecisionManifest(remaining.map(asManifestInput));
  assert.equal(validateDecisionManifest(manifest).valid, true);
  assertEqual("MANIFEST_COMPLETE_AUTO_CANDIDATES", manifest.manifest.summary.publishReady, 1328);
  assertEqual("MANIFEST_LEGACY_NOT_INCLUDED", manifest.manifest.summary.totalPartNumbers, 1386);
  assertEqual("MANIFEST_FITMENT_AUTO", manifest.manifest.summary.fitmentAutoVerified, 1343);
  assertEqual("MANIFEST_FITMENT_REVIEW", manifest.manifest.summary.fitmentReview, 54);
  assertEqual("MANIFEST_FITMENT_PENDING", manifest.manifest.summary.fitmentModelPending, 4);
  const pending = manifest.manifest.partNumbers.flatMap((item) => item.fitments
    .filter((fitment) => fitment.fitmentDecision === "MODEL_PENDING")
    .map((fitment) => ({ partNumber: item.partNumber, fitment })));
  assert.deepEqual(pending.map((item) => item.partNumber).sort(), ["A2U220-193386", "A2U900-472055", "A2U900-472060", "A2U913-651005"]);
  for (const { fitment } of pending) {
    assert.equal(fitment.equipment, "");
    assert.equal(fitment.reasonCode, "FITMENT_MODEL_PENDING");
  }
  assert.deepEqual(manifest.manifest.summary, summarizeManifestDecisions(manifest.manifest.partNumbers));
  assert.equal(manifest.manifest.sourceFingerprint, calculateSourceFingerprint(remaining.map(asManifestInput)));
  assert.equal(manifest.manifestFingerprint, calculateManifestFingerprint(manifest.manifest));
  assert.equal(serializeCanonicalJson(manifest.manifest), manifest.canonicalJson);
});

console.log("ASSET_GATE_V1_TESTS=PASS");
