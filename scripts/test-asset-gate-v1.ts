import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateFormat,
  evaluatePartNumberAsset,
  type AssetInput,
  type EvidenceFacts,
  type ModelEvidence,
} from "../src/lib/trust/asset-gate";

const ROOT = process.cwd();
const PN_CSV = resolve(ROOT, "data/part-numbers/kuangpeiyun_partnumber_import_v3.csv");
const REL_CSV = resolve(ROOT, "data/part-numbers/kuangpeiyun_equipment_relations_v3.csv");

// Production read-only fixture supplied by the V3.1 IMPORT_CREATE audit; never infer from ordering.
const EXISTING_IMPORTED = new Set(["016-15015", "016-63012", "016-63028", "016-92009", "016-93020", "06575109", "06575111", "06575124", "06581411", "100202", "100485", "101552", "102010", "102314", "103-04399", "103805", "106-03455", "107263", "110237", "111097", "114-8516LFL", "114962", "115028", "117867", "117900", "14 14", "20A", "222325", "222411", "222412", "222413", "222742", "224771", "226270", "226271", "228655", "229917", "234221", "244526", "244676", "246362", "246631", "246633", "247065", "248872", "254058", "255305", "263083200", "28GF", "359-1003458", "359-450002", "445202801", "445202804", "445208600", "445208660", "445208662", "445208762", "445208770", "445208807", "445210937", "445250791", "445402816", "445402819", "445402820", "445402855", "445402859", "445402861", "445402863", "445402864", "445402939", "445402941", "445402950", "445402954", "445402963", "445403077", "445403089", "445405075", "445502656", "445502660", "445502751", "445502755", "445502759", "445502761", "445502764", "445502767", "445502795", "445502799", "445502801", "445502802", "445502806", "445502807", "445502808", "445502842", "445502843", "445502844", "445502845", "445502847", "445502848", "445502933", "445502935", "445502937", "445502939", "445503069", "445503070", "445503072", "445504761", "445504939", "445512804", "445520802", "4455405082", "450061615", "450061617", "450061619", "450061624", "450062506", "450062508", "450063010", "450065518", "450081022", "450081034", "450081116", "45008112", "450081120", "450081124", "450081130", "45502807", "455300044", "455302034", "455302036", "455302040", "455309026", "455309030", "455309034", "455309036", "455309040", "455669026", "455669030", "455669034", "455669036", "455669044", "4697280", "4699377", "49502843", "495502845", "500400", "5450081124", "55025218", "56006630", "64112654", "64113616", "64117540", "64119126", "64119919", "64253186", "64400345", "64400369", "64404002", "64404396", "64404408", "64544447"]);

type Row = Record<string, string>;
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
function evidenceFrom(row: Row): EvidenceFacts {
  const summary = row.evidence_summary || "";
  return {
    provenanceConfirmed: (row.source_files || "").includes("伊泰LS190-ED10配件手册.pdf"),
    locatableOfficialClaim: /(ED10|LS190) (parts )?manual page \d+/i.test(summary),
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
    pn: { evidence: evidenceFrom(row), modelEvidence: (row.model_evidence || "NOT_EXPLICIT") as ModelEvidence, confidence: (row.confidence || "MEDIUM") as any, legacyVerified: row.verification === "VERIFIED", legacyVerificationStatus: row.verification, legacyPublishStatus: row.import_status },
    fitments: relations.map((relation) => ({
      equipment: relation.model || "",
      confirmedModel: Boolean(row.confirmed_models),
      modelEvidence: (relation.model_evidence || "NOT_EXPLICIT") as ModelEvidence,
      relationStatus: relation.relation_status === "ACTIVE" ? "ACTIVE" : relation.relation_status === "MODEL_PENDING" ? "MODEL_PENDING" : "OTHER",
      evidence: evidenceFrom(row),
      directModelSupport: relation.model === "ED10" ? /ED10 (parts )?manual page \d+/i.test(relation.evidence_summary || "") : relation.model === "LS190" ? /fitment to (Sandvik )?LS ?190/i.test(relation.evidence_summary || "") : false,
      legacyVerificationStatus: relation.verification,
      legacyEvidenceStatus: relation.model_evidence,
    })),
  };
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
  const results = remaining.map((row) => ({ number: row.part_number, result: evaluatePartNumberAsset(asInput(row)) }));
  const pn = count(results.map(({ result }) => result.pnDecision.decision));
  assertEqual("REMAINING_PN_AUTO", pn.AUTO_VERIFIED || 0, 1357); assertEqual("REMAINING_PN_REVIEW", pn.REVIEW || 0, 25); assertEqual("REMAINING_PN_HOLD", pn.HOLD || 0, 4);
  const fitments = results.flatMap(({ number, result }) => result.fitments.map((fitment) => ({ number, decision: fitment.decision.decision })));
  const fit = count(fitments.map((fitment) => fitment.decision));
  assertEqual("FITMENT_AUTO", fit.AUTO_VERIFIED || 0, 1343); assertEqual("FITMENT_REVIEW", fit.REVIEW || 0, 54); assertEqual("FITMENT_HOLD", fit.HOLD || 0, 0); assertEqual("FITMENT_PENDING", fit.MODEL_PENDING || 0, 4);
  const complete = results.filter(({ result }) => result.publishDecision.decision === "READY").map(({ number }) => number);
  assertEqual("COMPLETE_AUTO_CANDIDATES", complete.length, 1328, complete);
});

console.log("ASSET_GATE_V1_TESTS=PASS");
