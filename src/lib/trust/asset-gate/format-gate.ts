import type { Decision, FormatFacts, FormatStatus } from "./types";

export function evaluateFormat(facts: FormatFacts): Decision<FormatStatus> {
  if (!facts.partNumber.trim()) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_PART_NUMBER_EMPTY", reasons: ["part number is required"] };
  if (facts.malformedPartNumber) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_PART_NUMBER_MALFORMED", reasons: ["part number failed syntax validation"] };
  if (!facts.normalizedPartNumber.trim()) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_NORMALIZED_PART_NUMBER_EMPTY", reasons: ["normalized part number is required"] };
  if (facts.aliasCollision) return { decision: "FORMAT_ALIAS_REVIEW", reasonCode: "FORMAT_ALIAS_COLLISION", reasons: ["distinct part numbers share a normalized value"] };
  if (facts.normalizedCollision) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_NORMALIZED_COLLISION", reasons: ["normalized part number collides with an existing record"] };
  if (facts.slugCollision) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_SLUG_COLLISION", reasons: ["slug collides with an existing record"] };
  const missing = Object.entries(facts.requiredFields).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) return { decision: "FORMAT_HOLD", reasonCode: "FORMAT_REQUIRED_FIELD_MISSING", reasons: missing.map((key) => `required field missing: ${key}`) };
  return { decision: "FORMAT_READY", reasonCode: "FORMAT_VALID", reasons: ["format checks passed"] };
}
