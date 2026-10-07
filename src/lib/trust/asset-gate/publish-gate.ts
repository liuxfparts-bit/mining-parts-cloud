import type { Decision, FitmentDecision, FormatStatus, PNDecision, PublishDecision } from "./types";

export function evaluatePublish(format: FormatStatus, pn: PNDecision, fitments: FitmentDecision[], unresolvedConflict = false): Decision<PublishDecision> {
  if (format !== "FORMAT_READY") return { decision: "BLOCKED", reasonCode: "PUBLISH_FORMAT_NOT_READY", reasons: ["format gate did not pass"] };
  if (pn !== "AUTO_VERIFIED") return { decision: "BLOCKED", reasonCode: "PUBLISH_PN_NOT_AUTO_VERIFIED", reasons: ["PN identity gate did not pass"] };
  if (unresolvedConflict) return { decision: "BLOCKED", reasonCode: "PUBLISH_UNRESOLVED_CONFLICT", reasons: ["an unresolved conflict exists"] };
  if (!fitments.length || fitments.some((fitment) => fitment !== "AUTO_VERIFIED")) return { decision: "BLOCKED", reasonCode: "PUBLISH_FITMENT_NOT_AUTO_VERIFIED", reasons: ["one or more fitments did not pass"] };
  return { decision: "READY", reasonCode: "PUBLISH_ALL_GATES_PASSED", reasons: ["format, PN identity, and every fitment passed"] };
}
