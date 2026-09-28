export const RFQ_STATUS = {
  COLLECTING: "COLLECTING",
  QUOTED: "QUOTED",
  SELECTED: "SELECTED",
  CLOSED: "CLOSED",
  EXPIRED: "EXPIRED",
  REJECTED: "REJECTED", // legacy moderation state, not procurement lifecycle
} as const;

export type RfqStatus = (typeof RFQ_STATUS)[keyof typeof RFQ_STATUS];
const procurementTransitions: Record<Exclude<RfqStatus, "REJECTED">, readonly RfqStatus[]> = {
  COLLECTING: ["QUOTED", "CLOSED", "EXPIRED"],
  QUOTED: ["SELECTED", "CLOSED", "EXPIRED"],
  SELECTED: ["CLOSED"],
  CLOSED: [],
  EXPIRED: [],
};

export function isRfqStatus(value: unknown): value is RfqStatus {
  return typeof value === "string" && Object.hasOwn(RFQ_STATUS, value);
}

/** Normal procurement transitions only. REJECTED always fails closed. */
export function canTransitionRfq(from: unknown, to: unknown): boolean {
  return isRfqStatus(from) && from !== "REJECTED" && isRfqStatus(to) &&
    procurementTransitions[from].includes(to);
}

/**
 * Generic admin actions are deliberately narrower than procurement lifecycle.
 * QUOTED and SELECTED are business-derived states: only quote submission and
 * the buyer selection transaction may create them. Admin can only close an
 * active/completed RFQ or mark an active RFQ as legacy moderation REJECTED.
 */
export function canAdminTransitionRfq(from: unknown, to: unknown): boolean {
  if (!isRfqStatus(from) || !isRfqStatus(to)) return false;
  if (to === "CLOSED") return from === "COLLECTING" || from === "QUOTED" || from === "SELECTED";
  if (to === "REJECTED") return from === "COLLECTING" || from === "QUOTED";
  return false;
}

export function canAcceptQuotes(rfqStatus: unknown): boolean {
  return rfqStatus === "COLLECTING" || rfqStatus === "QUOTED";
}
