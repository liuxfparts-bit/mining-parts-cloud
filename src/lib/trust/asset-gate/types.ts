export const GATE_VERSION = "V1.0" as const;

export type FormatStatus = "FORMAT_READY" | "FORMAT_HOLD" | "FORMAT_ALIAS_REVIEW";
export type EvidenceClass = "OFFICIAL" | "CORROBORATED" | "HISTORICAL_SINGLE" | "INFERRED" | "CONFLICTED";
export type PNDecision = "AUTO_VERIFIED" | "REVIEW" | "HOLD";
export type FitmentDecision = "AUTO_VERIFIED" | "REVIEW" | "HOLD" | "MODEL_PENDING";
export type PublishDecision = "READY" | "BLOCKED";
export type ModelEvidence = "EXPLICIT" | "INFERRED" | "NOT_EXPLICIT";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface Decision<T extends string> {
  decision: T;
  reasonCode: string;
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
