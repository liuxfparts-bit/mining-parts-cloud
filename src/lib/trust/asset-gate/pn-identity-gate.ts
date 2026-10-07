import { classifyEvidence } from "./evidence-classifier";
import type { Decision, EvidenceClass, PNFacts, PNDecision } from "./types";

export function evaluatePNIdentity(facts: PNFacts, evidenceClass = classifyEvidence(facts.evidence)): Decision<PNDecision> {
  if (evidenceClass === "CONFLICTED") return { decision: "HOLD", reasonCode: "PN_EVIDENCE_CONFLICT", reasons: ["identity evidence is conflicted"] };
  if (facts.modelEvidence !== "EXPLICIT") return { decision: "HOLD", reasonCode: "PN_MODEL_EVIDENCE_NOT_EXPLICIT", reasons: ["model evidence is not explicit"] };
  if (facts.confidence === "LOW") return { decision: "HOLD", reasonCode: "PN_CONFIDENCE_LOW", reasons: ["confidence is low"] };
  if (evidenceClass === "OFFICIAL") return { decision: "AUTO_VERIFIED", reasonCode: "PN_OFFICIAL_EVIDENCE_CONFIRMED", reasons: ["official provenance and locator are confirmed"] };
  if (evidenceClass === "CORROBORATED") return { decision: "AUTO_VERIFIED", reasonCode: "PN_CORROBORATED_EVIDENCE_CONFIRMED", reasons: ["independent historical evidence is consistent"] };
  if (evidenceClass === "HISTORICAL_SINGLE") return { decision: "REVIEW", reasonCode: "PN_HISTORICAL_SINGLE_REVIEW", reasons: ["only one historical source supports identity"] };
  return { decision: "REVIEW", reasonCode: "PN_EVIDENCE_INFERRED_REVIEW", reasons: ["identity evidence is incomplete or inferred"] };
}
