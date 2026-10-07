export const GATE_VERSION = "V1.0" as const;

export type FormatStatus = "FORMAT_READY" | "FORMAT_HOLD" | "FORMAT_ALIAS_REVIEW";
export type EvidenceClass = "OFFICIAL" | "CORROBORATED" | "HISTORICAL_SINGLE" | "INFERRED" | "CONFLICTED";
export type PNDecision = "AUTO_VERIFIED" | "REVIEW" | "HOLD";
export type FitmentDecision = "AUTO_VERIFIED" | "REVIEW" | "HOLD" | "MODEL_PENDING";
export type PublishDecision = "READY" | "BLOCKED";
export type ModelEvidence = "EXPLICIT" | "INFERRED" | "NOT_EXPLICIT";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type GateReasonCode =
  | "FORMAT_PART_NUMBER_EMPTY"
  | "FORMAT_PART_NUMBER_MALFORMED"
  | "FORMAT_NORMALIZED_PART_NUMBER_EMPTY"
  | "FORMAT_ALIAS_COLLISION"
  | "FORMAT_NORMALIZED_COLLISION"
  | "FORMAT_SLUG_COLLISION"
  | "FORMAT_REQUIRED_FIELD_MISSING"
  | "FORMAT_VALID"
  | "PN_EVIDENCE_CONFLICT"
  | "PN_MODEL_EVIDENCE_NOT_EXPLICIT"
  | "PN_CONFIDENCE_LOW"
  | "PN_OFFICIAL_EVIDENCE_CONFIRMED"
  | "PN_CORROBORATED_EVIDENCE_CONFIRMED"
  | "PN_HISTORICAL_SINGLE_REVIEW"
  | "PN_EVIDENCE_INFERRED_REVIEW"
  | "FITMENT_MODEL_PENDING"
  | "FITMENT_EVIDENCE_CONFLICT"
  | "FITMENT_PN_NOT_AUTO_VERIFIED"
  | "FITMENT_PROVENANCE_INSUFFICIENT"
  | "FITMENT_EXPLICIT_PROVENANCE_CONFIRMED"
  | "PUBLISH_FORMAT_NOT_READY"
  | "PUBLISH_PN_NOT_AUTO_VERIFIED"
  | "PUBLISH_UNRESOLVED_CONFLICT"
  | "PUBLISH_FITMENT_NOT_AUTO_VERIFIED"
  | "PUBLISH_ALL_GATES_PASSED";

export interface Decision<T extends string> {
  decision: T;
  reasonCode: GateReasonCode;
  reasons: string[];
}

export interface FormatFacts {
  partNumber: string;
  normalizedPartNumber: string;
  slug: string;
  requiredFields: { number: boolean; slug: boolean; name: boolean; category: boolean };
  malformedPartNumber?: boolean;
  normalizedCollision?: boolean;
  aliasCollision?: boolean;
  slugCollision?: boolean;
}

/** Structured facts only. The engine never parses source filenames or free-form summaries. */
export interface EvidenceFacts {
  provenanceConfirmed: boolean;
  locatableOfficialClaim: boolean;
  independentHistoricalSources: number;
  hasConflict?: boolean;
  evidenceMissing?: boolean;
}

export interface PNFacts {
  evidence: EvidenceFacts;
  modelEvidence: ModelEvidence;
  confidence: Confidence;
  legacyVerified?: boolean;
  legacyVerificationStatus?: string;
  legacyPublishStatus?: string;
}

export interface FitmentFacts {
  equipment: string;
  confirmedModel: boolean;
  modelEvidence: ModelEvidence;
  relationStatus: "ACTIVE" | "MODEL_PENDING" | "OTHER";
  evidence: EvidenceFacts;
  directModelSupport: boolean;
  legacyVerificationStatus?: string;
  legacyEvidenceStatus?: string;
}

export interface AssetInput {
  format: FormatFacts;
  pn: PNFacts;
  fitments: FitmentFacts[];
  unresolvedConflict?: boolean;
}

export interface FitmentResult {
  equipment: string;
  evidenceClass: EvidenceClass;
  decision: Decision<FitmentDecision>;
}

export interface AssetGateResult {
  gateVersion: typeof GATE_VERSION;
  formatDecision: Decision<FormatStatus>;
  evidenceClass: EvidenceClass;
  pnDecision: Decision<PNDecision>;
  fitments: FitmentResult[];
  publishDecision: Decision<PublishDecision>;
}
