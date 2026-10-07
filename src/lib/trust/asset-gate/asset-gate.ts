import { classifyEvidence } from "./evidence-classifier";
import { evaluateFitment } from "./fitment-gate";
import { evaluateFormat } from "./format-gate";
import { evaluatePNIdentity } from "./pn-identity-gate";
import { evaluatePublish } from "./publish-gate";
import { GATE_VERSION, type AssetGateResult, type AssetInput } from "./types";

export function evaluatePartNumberAsset(input: AssetInput): AssetGateResult {
  const formatDecision = evaluateFormat(input.format);
  const evidenceClass = classifyEvidence(input.pn.evidence);
  const pnDecision = evaluatePNIdentity(input.pn, evidenceClass);
  const fitments = input.fitments.map((fitment) => ({
    equipment: fitment.equipment,
    evidenceClass: classifyEvidence(fitment.evidence),
    decision: evaluateFitment(fitment, pnDecision.decision),
  }));
  return {
    gateVersion: GATE_VERSION,
    formatDecision,
    evidenceClass,
    pnDecision,
    fitments,
    publishDecision: evaluatePublish(formatDecision.decision, pnDecision.decision, fitments.map((fitment) => fitment.decision.decision), input.unresolvedConflict),
  };
}
