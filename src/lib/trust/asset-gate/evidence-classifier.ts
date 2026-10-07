import type { EvidenceClass, EvidenceFacts } from "./types";

export function classifyEvidence(facts: EvidenceFacts): EvidenceClass {
  if (facts.hasConflict) return "CONFLICTED";
  if (facts.provenanceConfirmed && facts.locatableOfficialClaim) return "OFFICIAL";
  if (facts.independentHistoricalSources >= 2) return "CORROBORATED";
  if (facts.independentHistoricalSources === 1) return "HISTORICAL_SINGLE";
  return "INFERRED";
}
