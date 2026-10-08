import { createHash } from "node:crypto";

import { evaluatePartNumberAsset } from "./asset-gate";
import { evaluatePublish } from "./publish-gate";
import {
  GATE_REASON_CODES,
  GATE_VERSION,
  type AssetGateResult,
  type AssetInput,
  type EvidenceClass,
  type FitmentDecision,
  type FormatStatus,
  type GateReasonCode,
  type PNDecision,
  type PublishDecision,
} from "./types";

/** Structure version only; Gate semantics remain identified by GATE_VERSION. */
export const MANIFEST_SCHEMA_VERSION = "1.0" as const;

export interface ManifestEvidenceReference {
  /** Stable source-local identifier, never a filesystem path or a runtime value. */
  reference: string;
}

export interface ManifestFitmentInput {
  /** Relationship-specific provenance only. Never PN-level provenance. */
  evidenceReferences?: readonly ManifestEvidenceReference[];
}

export interface ManifestBuildInput {
  partNumber: string;
  /** Normalized facts supplied to, and evaluated by, the Phase 1 Gate Engine. */
  gateInput: AssetInput;
  /** PN identity provenance references; they do not influence Gate decisions. */
  pnEvidenceReferences?: readonly ManifestEvidenceReference[];
  /** One entry for each gateInput.fitments entry, preserving evidence scope. */
  fitments?: readonly ManifestFitmentInput[];
}

export interface ManifestFitmentDecision {
  equipment: string;
  evidenceClass: EvidenceClass;
  fitmentDecision: FitmentDecision;
  reasonCode: GateReasonCode;
  evidenceReferences: ManifestEvidenceReference[];
}

export interface ManifestPartNumberDecision {
  partNumber: string;
  formatDecision: FormatStatus;
  formatReasonCode: GateReasonCode;
  pnEvidenceClass: EvidenceClass;
  pnDecision: PNDecision;
  pnReasonCode: GateReasonCode;
  pnEvidenceReferences: ManifestEvidenceReference[];
  fitments: ManifestFitmentDecision[];
  publishDecision: PublishDecision;
  publishReasonCode: GateReasonCode;
  gateVersion: typeof GATE_VERSION;
}

export interface DecisionManifestSummary {
  totalPartNumbers: number;
  formatReady: number;
  formatHold: number;
  formatAliasReview: number;
  pnAutoVerified: number;
  pnReview: number;
  pnHold: number;
  fitmentAutoVerified: number;
  fitmentReview: number;
  fitmentHold: number;
  fitmentModelPending: number;
  publishReady: number;
  publishBlocked: number;
}

/** This is the canonical, hashable payload. It deliberately has no runtime metadata. */
export interface CanonicalDecisionManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  gateVersion: typeof GATE_VERSION;
  sourceFingerprint: string;
  summary: DecisionManifestSummary;
  partNumbers: ManifestPartNumberDecision[];
}

/** The fingerprint is an envelope field, avoiding a self-hashing payload. */
export interface DecisionManifestArtifact {
  manifest: CanonicalDecisionManifest;
  canonicalJson: string;
  manifestFingerprint: string;
}

export type ManifestValidationReasonCode =
  | "MANIFEST_NOT_OBJECT"
  | "MANIFEST_SCHEMA_VERSION_UNSUPPORTED"
  | "MANIFEST_GATE_VERSION_UNSUPPORTED"
  | "MANIFEST_SOURCE_FINGERPRINT_INVALID"
  | "MANIFEST_FINGERPRINT_INVALID"
  | "MANIFEST_PART_NUMBERS_INVALID"
  | "MANIFEST_PART_NUMBER_DUPLICATE"
  | "MANIFEST_FITMENT_DUPLICATE"
  | "MANIFEST_ENUM_INVALID"
  | "MANIFEST_REASON_CODE_INVALID"
  | "MANIFEST_REQUIRED_FIELD_MISSING"
  | "MANIFEST_FIELD_TYPE_INVALID"
  | "MANIFEST_PART_NUMBER_ENTRY_INVALID"
  | "MANIFEST_FITMENT_ENTRY_INVALID"
  | "MANIFEST_SUMMARY_INVALID"
  | "MANIFEST_CANONICAL_JSON_INVALID"
  | "MANIFEST_UNEXPECTED_FIELD"
  | "MANIFEST_DECISION_INCONSISTENT";

export interface ManifestValidationError {
  code: ManifestValidationReasonCode;
  path: string;
  message: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationError[];
}

const SHA_256 = /^[a-f0-9]{64}$/;
const formatStatuses = new Set<FormatStatus>(["FORMAT_READY", "FORMAT_HOLD", "FORMAT_ALIAS_REVIEW"]);
const evidenceClasses = new Set<EvidenceClass>(["OFFICIAL", "CORROBORATED", "HISTORICAL_SINGLE", "INFERRED", "CONFLICTED"]);
const pnDecisions = new Set<PNDecision>(["AUTO_VERIFIED", "REVIEW", "HOLD"]);
const fitmentDecisions = new Set<FitmentDecision>(["AUTO_VERIFIED", "REVIEW", "HOLD", "MODEL_PENDING"]);
const publishDecisions = new Set<PublishDecision>(["READY", "BLOCKED"]);
const reasonCodes = new Set<string>(GATE_REASON_CODES);

function compareStable(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requiredString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }

/** Recursively sorts object keys. Arrays retain their intentional, builder-normalized order. */
export function serializeCanonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON does not allow non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(serializeCanonicalJson).join(",")}]`;
  if (!isRecord(value)) throw new Error("Canonical JSON only accepts JSON values");
  return `{${Object.keys(value).sort(compareStable).map((key) => `${JSON.stringify(key)}:${serializeCanonicalJson(value[key])}`).join(",")}}`;
}

function canonicalReferences(references: readonly ManifestEvidenceReference[] = []): ManifestEvidenceReference[] {
  return Array.from(new Set(references.map(({ reference }) => reference.trim()).filter(Boolean)))
    .sort(compareStable)
    .map((reference) => ({ reference }));
}

function canonicalSourceInput(input: ManifestBuildInput): Record<string, unknown> {
  const gateInput = {
    ...input.gateInput,
    // Fitment order has no Gate meaning, so normalize it before hashing input.
    fitments: [...input.gateInput.fitments].sort((a, b) => compareStable(a.equipment, b.equipment)),
  };
  return {
    partNumber: input.partNumber.trim(),
    // JSON normalization removes optional undefined values before the explicit
    // canonical serializer orders every remaining key.
    gateInput: JSON.parse(JSON.stringify(gateInput)),
  };
}

export function calculateSourceFingerprint(inputs: readonly ManifestBuildInput[]): string {
  const normalized = [...inputs].map(canonicalSourceInput).sort((a, b) => compareStable(serializeCanonicalJson(a), serializeCanonicalJson(b)));
  return sha256(serializeCanonicalJson(normalized));
}

function resultToDecision(input: ManifestBuildInput, result: AssetGateResult): ManifestPartNumberDecision {
  if (!input.partNumber.trim()) throw new Error("Manifest input requires partNumber");
  if (input.fitments && input.fitments.length !== result.fitments.length) throw new Error(`Manifest fitment metadata count mismatch for ${input.partNumber}`);
  const fitments = result.fitments.map((fitment, index) => ({
    equipment: fitment.equipment.trim(),
    evidenceClass: fitment.evidenceClass,
    fitmentDecision: fitment.decision.decision,
    reasonCode: fitment.decision.reasonCode,
    evidenceReferences: canonicalReferences(input.fitments?.[index]?.evidenceReferences),
  })).sort((a, b) => compareStable(a.equipment, b.equipment));
  if (new Set(fitments.map((fitment) => fitment.equipment)).size !== fitments.length) throw new Error(`Duplicate fitment equipment for ${input.partNumber}`);
  return {
    partNumber: input.partNumber.trim(),
    formatDecision: result.formatDecision.decision,
    formatReasonCode: result.formatDecision.reasonCode,
    pnEvidenceClass: result.evidenceClass,
    pnDecision: result.pnDecision.decision,
    pnReasonCode: result.pnDecision.reasonCode,
    pnEvidenceReferences: canonicalReferences(input.pnEvidenceReferences),
    fitments,
    publishDecision: result.publishDecision.decision,
    publishReasonCode: result.publishDecision.reasonCode,
    gateVersion: result.gateVersion,
  };
}

export function summarizeManifestDecisions(partNumbers: readonly ManifestPartNumberDecision[]): DecisionManifestSummary {
  const summary: DecisionManifestSummary = { totalPartNumbers: partNumbers.length, formatReady: 0, formatHold: 0, formatAliasReview: 0, pnAutoVerified: 0, pnReview: 0, pnHold: 0, fitmentAutoVerified: 0, fitmentReview: 0, fitmentHold: 0, fitmentModelPending: 0, publishReady: 0, publishBlocked: 0 };
  for (const item of partNumbers) {
    if (item.formatDecision === "FORMAT_READY") summary.formatReady++;
    if (item.formatDecision === "FORMAT_HOLD") summary.formatHold++;
    if (item.formatDecision === "FORMAT_ALIAS_REVIEW") summary.formatAliasReview++;
    if (item.pnDecision === "AUTO_VERIFIED") summary.pnAutoVerified++;
    if (item.pnDecision === "REVIEW") summary.pnReview++;
    if (item.pnDecision === "HOLD") summary.pnHold++;
    if (item.publishDecision === "READY") summary.publishReady++; else summary.publishBlocked++;
    for (const fitment of item.fitments) {
      if (fitment.fitmentDecision === "AUTO_VERIFIED") summary.fitmentAutoVerified++;
      if (fitment.fitmentDecision === "REVIEW") summary.fitmentReview++;
      if (fitment.fitmentDecision === "HOLD") summary.fitmentHold++;
      if (fitment.fitmentDecision === "MODEL_PENDING") summary.fitmentModelPending++;
    }
  }
  return summary;
}

export function calculateManifestFingerprint(manifest: CanonicalDecisionManifest): string { return sha256(serializeCanonicalJson(manifest)); }

/** Uses the Phase 1 engine for every decision; this module only preserves those decisions canonically. */
export function buildDecisionManifest(inputs: readonly ManifestBuildInput[]): DecisionManifestArtifact {
  for (const input of inputs) {
    if (input.partNumber !== input.gateInput.format.partNumber) throw new Error("Manifest PN identity must match Gate input partNumber");
  }
  const partNumbers = [...inputs].map((input) => resultToDecision(input, evaluatePartNumberAsset(input.gateInput))).sort((a, b) => compareStable(a.partNumber, b.partNumber));
  if (new Set(partNumbers.map((partNumber) => partNumber.partNumber)).size !== partNumbers.length) throw new Error("Duplicate manifest partNumber");
  const manifest: CanonicalDecisionManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    gateVersion: GATE_VERSION,
    sourceFingerprint: calculateSourceFingerprint(inputs),
    summary: summarizeManifestDecisions(partNumbers),
    partNumbers,
  };
  const canonicalJson = serializeCanonicalJson(manifest);
  return { manifest, canonicalJson, manifestFingerprint: sha256(canonicalJson) };
}

function error(errors: ManifestValidationError[], code: ManifestValidationReasonCode, path: string, message: string) { errors.push({ code, path, message }); }
function validateReason(value: unknown, path: string, errors: ManifestValidationError[]) { if (!requiredString(value) || !reasonCodes.has(value)) error(errors, "MANIFEST_REASON_CODE_INVALID", path, "reasonCode must be a GateReasonCode"); }
function isReferences(value: unknown): value is ManifestEvidenceReference[] {
  return Array.isArray(value) && value.every((reference) => isRecord(reference) && requiredString(reference.reference));
}
const summaryFields: readonly (keyof DecisionManifestSummary)[] = ["totalPartNumbers", "formatReady", "formatHold", "formatAliasReview", "pnAutoVerified", "pnReview", "pnHold", "fitmentAutoVerified", "fitmentReview", "fitmentHold", "fitmentModelPending", "publishReady", "publishBlocked"];
function isSummary(value: unknown): value is DecisionManifestSummary {
  if (!isRecord(value)) return false;
  return summaryFields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]));
}
function validateFields(value: Record<string, unknown>, fields: readonly string[], path: string, errors: ManifestValidationError[]) {
  for (const key of Object.keys(value)) if (!fields.includes(key)) error(errors, "MANIFEST_UNEXPECTED_FIELD", `${path}.${key}`, "field is not defined by the closed Manifest schema");
}
function validateReferenceFields(value: unknown, path: string, errors: ManifestValidationError[]) {
  if (Array.isArray(value)) value.forEach((reference, index) => {
    if (isRecord(reference)) validateFields(reference, ["reference"], `${path}[${index}]`, errors);
  });
}
function isFitmentStructure(value: unknown): value is ManifestFitmentDecision {
  return isRecord(value)
    && (requiredString(value.equipment)
      || (value.equipment === "" && value.fitmentDecision === "MODEL_PENDING" && value.reasonCode === "FITMENT_MODEL_PENDING"))
    && requiredString(value.evidenceClass)
    && requiredString(value.fitmentDecision)
    && requiredString(value.reasonCode)
    && isReferences(value.evidenceReferences);
}
function isPartNumberStructure(value: unknown): value is ManifestPartNumberDecision {
  return isRecord(value)
    && requiredString(value.partNumber)
    && requiredString(value.formatDecision)
    && requiredString(value.formatReasonCode)
    && requiredString(value.pnEvidenceClass)
    && requiredString(value.pnDecision)
    && requiredString(value.pnReasonCode)
    && isReferences(value.pnEvidenceReferences)
    && Array.isArray(value.fitments)
    && value.fitments.every(isFitmentStructure)
    && requiredString(value.publishDecision)
    && requiredString(value.publishReasonCode)
    && requiredString(value.gateVersion);
}

/** Snapshot every field, including extras, without invoking accessors or dropping values. */
function snapshotJson(value: unknown, ancestors = new Set<object>(), depth = 0): unknown {
  if (depth > 128) throw new Error("JSON nesting limit exceeded");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null) throw new Error("Unsupported JSON value");
  if (ancestors.has(value)) throw new Error("Cyclic JSON value");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("JSON container must be plain");
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length) throw new Error("Symbol JSON property");
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(descriptors)) {
      if (array && key === "length") continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !("value" in descriptor)) throw new Error("JSON properties must be enumerable data fields");
      copy[key] = snapshotJson(descriptor.value, ancestors, depth + 1);
    }
    if (!array) return copy;
    const length = (value as unknown[]).length;
    if (Object.keys(copy).length !== length) throw new Error("JSON arrays must be dense and have no extra fields");
    const result: unknown[] = [];
    for (let index = 0; index < length; index++) {
      if (!Object.prototype.hasOwnProperty.call(copy, String(index))) throw new Error("Sparse JSON array");
      result.push(copy[String(index)]);
    }
    return result;
  } finally { ancestors.delete(value); }
}

// These matrices describe possible Phase 1 outputs; they never grant Trust.
const formatReasons: Partial<Record<GateReasonCode, FormatStatus>> = {
  FORMAT_PART_NUMBER_EMPTY: "FORMAT_HOLD", FORMAT_PART_NUMBER_MALFORMED: "FORMAT_HOLD",
  FORMAT_NORMALIZED_PART_NUMBER_EMPTY: "FORMAT_HOLD", FORMAT_ALIAS_COLLISION: "FORMAT_ALIAS_REVIEW",
  FORMAT_NORMALIZED_COLLISION: "FORMAT_HOLD", FORMAT_SLUG_COLLISION: "FORMAT_HOLD",
  FORMAT_REQUIRED_FIELD_MISSING: "FORMAT_HOLD", FORMAT_VALID: "FORMAT_READY",
};
function pnConsistent(item: ManifestPartNumberDecision): boolean {
  const { pnDecision: decision, pnReasonCode: reason, pnEvidenceClass: evidence } = item;
  if (evidence === "CONFLICTED") return decision === "HOLD" && reason === "PN_EVIDENCE_CONFLICT";
  switch (reason) {
    case "PN_MODEL_EVIDENCE_NOT_EXPLICIT": case "PN_CONFIDENCE_LOW": return decision === "HOLD";
    case "PN_OFFICIAL_EVIDENCE_CONFIRMED": return decision === "AUTO_VERIFIED" && evidence === "OFFICIAL";
    case "PN_CORROBORATED_EVIDENCE_CONFIRMED": return decision === "AUTO_VERIFIED" && evidence === "CORROBORATED";
    case "PN_HISTORICAL_SINGLE_REVIEW": return decision === "REVIEW" && evidence === "HISTORICAL_SINGLE";
    case "PN_EVIDENCE_INFERRED_REVIEW": return decision === "REVIEW" && evidence === "INFERRED";
    default: return false;
  }
}
function fitmentConsistent(fitment: ManifestFitmentDecision, pn: PNDecision): boolean {
  const { fitmentDecision: decision, reasonCode: reason, evidenceClass: evidence } = fitment;
  if (decision === "MODEL_PENDING") return reason === "FITMENT_MODEL_PENDING";
  if (!fitment.equipment.trim()) return false;
  if (evidence === "CONFLICTED") return decision === "HOLD" && reason === "FITMENT_EVIDENCE_CONFLICT";
  if (pn !== "AUTO_VERIFIED") return decision === "REVIEW" && reason === "FITMENT_PN_NOT_AUTO_VERIFIED";
  if (decision === "REVIEW") return reason === "FITMENT_PROVENANCE_INSUFFICIENT";
  return decision === "AUTO_VERIFIED" && reason === "FITMENT_EXPLICIT_PROVENANCE_CONFIRMED" && evidence !== "INFERRED";
}

export function validateDecisionManifest(artifact: unknown): ManifestValidationResult {
  try { return validateJsonDecisionManifest(snapshotJson(artifact)); }
  catch {
    return { valid: false, errors: [{ code: "MANIFEST_FIELD_TYPE_INVALID", path: "$", message: "artifact must be a bounded, acyclic plain JSON structure with supported values and serializable fields" }] };
  }
}

function validateJsonDecisionManifest(artifact: unknown): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  if (!isRecord(artifact)) return { valid: false, errors: [{ code: "MANIFEST_NOT_OBJECT", path: "$", message: "artifact must be an object" }] };
  if (!isRecord(artifact.manifest)) return { valid: false, errors: [{ code: "MANIFEST_NOT_OBJECT", path: "manifest", message: "manifest must be an object" }] };
  validateFields(artifact, ["manifest", "canonicalJson", "manifestFingerprint"], "$", errors);
  const manifestFingerprint = requiredString(artifact.manifestFingerprint) ? artifact.manifestFingerprint : "";
  if (!manifestFingerprint) error(errors, "MANIFEST_REQUIRED_FIELD_MISSING", "manifestFingerprint", "manifestFingerprint is required and must be a string");
  if (typeof artifact.canonicalJson !== "string") error(errors, "MANIFEST_CANONICAL_JSON_INVALID", "canonicalJson", "canonicalJson is required and must be a string");
  const manifest = artifact.manifest;
  validateFields(manifest, ["schemaVersion", "gateVersion", "sourceFingerprint", "summary", "partNumbers"], "manifest", errors);
  if (isRecord(manifest.summary)) validateFields(manifest.summary, summaryFields, "manifest.summary", errors);
  if (!requiredString(manifest.schemaVersion)) error(errors, "MANIFEST_REQUIRED_FIELD_MISSING", "manifest.schemaVersion", "schemaVersion is required and must be a string");
  if (!requiredString(manifest.gateVersion)) error(errors, "MANIFEST_REQUIRED_FIELD_MISSING", "manifest.gateVersion", "gateVersion is required and must be a string");
  if (!requiredString(manifest.sourceFingerprint)) error(errors, "MANIFEST_REQUIRED_FIELD_MISSING", "manifest.sourceFingerprint", "sourceFingerprint is required and must be a string");
  if (!Array.isArray(manifest.partNumbers)) error(errors, "MANIFEST_PART_NUMBERS_INVALID", "manifest.partNumbers", "partNumbers must be an array");
  if (!isSummary(manifest.summary)) error(errors, "MANIFEST_SUMMARY_INVALID", "manifest.summary", "summary must contain every finite numeric count");
  if (Array.isArray(manifest.partNumbers)) {
    for (let index = 0; index < manifest.partNumbers.length; index++) {
      const item = manifest.partNumbers[index]; const path = `manifest.partNumbers[${index}]`;
      if (!isRecord(item)) { error(errors, "MANIFEST_PART_NUMBER_ENTRY_INVALID", path, "partNumber entry must be an object"); continue; }
      validateFields(item, ["partNumber", "formatDecision", "formatReasonCode", "pnEvidenceClass", "pnDecision", "pnReasonCode", "pnEvidenceReferences", "fitments", "publishDecision", "publishReasonCode", "gateVersion"], path, errors);
      validateReferenceFields(item.pnEvidenceReferences, `${path}.pnEvidenceReferences`, errors);
      if (Array.isArray(item.fitments)) item.fitments.forEach((fitment, fitmentIndex) => {
        if (isRecord(fitment)) {
          const fitmentPath = `${path}.fitments[${fitmentIndex}]`;
          validateFields(fitment, ["equipment", "evidenceClass", "fitmentDecision", "reasonCode", "evidenceReferences"], fitmentPath, errors);
          validateReferenceFields(fitment.evidenceReferences, `${fitmentPath}.evidenceReferences`, errors);
        }
      });
      if (!isPartNumberStructure(item)) {
        error(errors, "MANIFEST_PART_NUMBER_ENTRY_INVALID", path, "partNumber entry is missing a required field or has an invalid field type");
        if (!Array.isArray(item.fitments)) error(errors, "MANIFEST_FIELD_TYPE_INVALID", `${path}.fitments`, "fitments must be an array");
        else for (let fitmentIndex = 0; fitmentIndex < item.fitments.length; fitmentIndex++) if (!isFitmentStructure(item.fitments[fitmentIndex])) error(errors, "MANIFEST_FITMENT_ENTRY_INVALID", `${path}.fitments[${fitmentIndex}]`, "fitment entry is missing a required field or has an invalid field type");
      }
    }
  }
  // Do not summarize, canonicalize, or hash an unsafe external structure.
  if (errors.length) return { valid: false, errors };

  const safeManifest = manifest as unknown as CanonicalDecisionManifest;
  const partNumbers = safeManifest.partNumbers;
  if (safeManifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) error(errors, "MANIFEST_SCHEMA_VERSION_UNSUPPORTED", "manifest.schemaVersion", "unsupported schemaVersion");
  if (safeManifest.gateVersion !== GATE_VERSION) error(errors, "MANIFEST_GATE_VERSION_UNSUPPORTED", "manifest.gateVersion", "unsupported gateVersion");
  if (!SHA_256.test(safeManifest.sourceFingerprint)) error(errors, "MANIFEST_SOURCE_FINGERPRINT_INVALID", "manifest.sourceFingerprint", "sourceFingerprint must be SHA-256 hex");
  if (!SHA_256.test(manifestFingerprint)) error(errors, "MANIFEST_FINGERPRINT_INVALID", "manifestFingerprint", "manifestFingerprint must be SHA-256 hex");
  const seenPartNumbers = new Set<string>();
  for (let index = 0; index < partNumbers.length; index++) {
    const item = partNumbers[index]; const path = `manifest.partNumbers[${index}]`;
    if (seenPartNumbers.has(item.partNumber)) error(errors, "MANIFEST_PART_NUMBER_DUPLICATE", `${path}.partNumber`, "duplicate partNumber"); seenPartNumbers.add(item.partNumber);
    if (!formatStatuses.has(item.formatDecision as FormatStatus) || !pnDecisions.has(item.pnDecision as PNDecision) || !evidenceClasses.has(item.pnEvidenceClass as EvidenceClass) || !publishDecisions.has(item.publishDecision as PublishDecision)) error(errors, "MANIFEST_ENUM_INVALID", path, "invalid decision enum");
    if (item.gateVersion !== GATE_VERSION) error(errors, "MANIFEST_GATE_VERSION_UNSUPPORTED", `${path}.gateVersion`, "partNumber gateVersion must match the supported Gate version");
    validateReason(item.formatReasonCode, `${path}.formatReasonCode`, errors); validateReason(item.pnReasonCode, `${path}.pnReasonCode`, errors); validateReason(item.publishReasonCode, `${path}.publishReasonCode`, errors);
    if (formatReasons[item.formatReasonCode] !== item.formatDecision) error(errors, "MANIFEST_DECISION_INCONSISTENT", `${path}.formatReasonCode`, "format decision and reason must match Phase 1");
    if (!pnConsistent(item)) error(errors, "MANIFEST_DECISION_INCONSISTENT", `${path}.pnReasonCode`, "PN decision, reason and evidence class must match Phase 1");
    const equipment = new Set<string>();
    for (let fitmentIndex = 0; fitmentIndex < item.fitments.length; fitmentIndex++) {
      const fitment = item.fitments[fitmentIndex]; const fitmentPath = `${path}.fitments[${fitmentIndex}]`;
      if (equipment.has(fitment.equipment)) error(errors, "MANIFEST_FITMENT_DUPLICATE", `${fitmentPath}.equipment`, "duplicate equipment within partNumber"); equipment.add(fitment.equipment);
      if (!evidenceClasses.has(fitment.evidenceClass as EvidenceClass) || !fitmentDecisions.has(fitment.fitmentDecision as FitmentDecision)) error(errors, "MANIFEST_ENUM_INVALID", fitmentPath, "invalid fitment enum");
      validateReason(fitment.reasonCode, `${fitmentPath}.reasonCode`, errors);
      if (!fitmentConsistent(fitment, item.pnDecision)) error(errors, "MANIFEST_DECISION_INCONSISTENT", fitmentPath, "fitment decision, reason, evidence and PN decision must match Phase 1");
    }
    // Conflict facts are not embedded. This checks reason/priority consistency,
    // not independent evidence of an unresolved conflict.
    const publish = evaluatePublish(item.formatDecision, item.pnDecision, item.fitments.map((fitment) => fitment.fitmentDecision), item.publishReasonCode === "PUBLISH_UNRESOLVED_CONFLICT");
    if (item.publishDecision !== publish.decision || item.publishReasonCode !== publish.reasonCode) error(errors, "MANIFEST_DECISION_INCONSISTENT", `${path}.publishDecision`, "publish decision and reason must match Phase 1 priority and all fitments");
  }
  const actual = summarizeManifestDecisions(partNumbers);
  if (serializeCanonicalJson(safeManifest.summary) !== serializeCanonicalJson(actual)) error(errors, "MANIFEST_SUMMARY_INVALID", "manifest.summary", "summary does not match decisions");
  const canonicalJson = serializeCanonicalJson(safeManifest);
  if (artifact.canonicalJson !== canonicalJson) error(errors, "MANIFEST_CANONICAL_JSON_INVALID", "canonicalJson", "canonicalJson does not match canonical manifest");
  if (sha256(canonicalJson) !== manifestFingerprint) error(errors, "MANIFEST_FINGERPRINT_INVALID", "manifestFingerprint", "fingerprint does not match canonical manifest");
  return { valid: errors.length === 0, errors };
}
