import { classifyEvidence } from "./evidence-classifier";
import type { Decision, FitmentDecision, FitmentFacts, PNDecision } from "./types";

export function evaluateFitment(facts: FitmentFacts, pnDecision: PNDecision): Decision<FitmentDecision> {
  if (!facts.equipment.trim() || !facts.confirmedModel || facts.relationStatus === "MODEL_PENDING" || facts.modelEvidence !== "EXPLICIT") {
    return { decision: "MODEL_PENDING", reasonCode: "FITMENT_MODEL_PENDING", reasons: ["equipment model is absent, unconfirmed, pending, or not explicit"] };
  }
  if (facts.evidence.hasConflict) return { decision: "HOLD", reasonCode: "FITMENT_EVIDENCE_CONFLICT", reasons: ["fitment evidence is conflicted"] };
  if (pnDecision !== "AUTO_VERIFIED") return { decision: "REVIEW", reasonCode: "FITMENT_PN_NOT_AUTO_VERIFIED", reasons: ["PN identity is not auto verified"] };
  if (!facts.directModelSupport || classifyEvidence(facts.evidence) === "INFERRED" || facts.evidence.evidenceMissing) {
    return { decision: "REVIEW", reasonCode: "FITMENT_PROVENANCE_INSUFFICIENT", reasons: ["relationship evidence does not independently support this equipment"] };
  }
  return { decision: "AUTO_VERIFIED", reasonCode: "FITMENT_EXPLICIT_PROVENANCE_CONFIRMED", reasons: ["model-specific evidence and PN identity are confirmed"] };
}
