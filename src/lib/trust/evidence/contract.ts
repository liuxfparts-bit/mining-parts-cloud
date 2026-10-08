// Phase 3B-1: metadata capture only. Never produces provenanceConfirmed or Gate trust.
export const EVIDENCE_FOUNDATION_VERSION = "3B1.1" as const;
export type CaptureState = "PENDING_CAPTURE" | "CAPTURED_UNVERIFIED";
export type ReviewDimension = "SOURCE_METADATA" | "ITEM_FIDELITY";
export type ReviewOutcome = "CONFIRMED" | "REJECTED" | "REQUEST_MORE_EVIDENCE" | "CONFLICT" | "REVOKED";
export interface SourceSnapshot {
  stableKey: string; revision: number; declaredKind: string; title: string;
  issuerClaim?: string | null; documentNumber?: string | null; edition?: string | null;
  acquisitionMethod?: string | null; acquisitionNote?: string | null;
  independenceGroupClaim?: string | null; captureState: CaptureState;
}
export interface ItemSnapshot {
  stableKey: string; revision: number; sourceStableKey: string;
  sourceRevision: number; sourceFingerprint: string; locatorKey: string;
  pageLabel?: string | null; sectionLabel?: string | null;
  itemLabel?: string | null; rowLabel?: string | null;
  excerpt?: string | null; extractionMethod?: string | null; captureState: CaptureState;
}
