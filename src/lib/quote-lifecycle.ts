export const QUOTE_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type QuoteStatus = (typeof QUOTE_STATUS)[keyof typeof QUOTE_STATUS];

const transitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && Object.hasOwn(transitions, value);
}

/** Unknown and terminal states fail closed. */
export function canTransitionQuote(from: unknown, to: unknown): boolean {
  return isQuoteStatus(from) && isQuoteStatus(to) && transitions[from].includes(to);
}
