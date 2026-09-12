/**
 * Deterministic split math. No LLM involved: agents decide *whether* to split
 * and *between how many*; the arithmetic stays plain code.
 */

export function amountPerPerson(total: number, people: number): number {
  return Math.round(total / people);
}

/** Demo-only payment request payload. Replaced by a real PISP/QR API later. */
export function buildPaymentPayload(amount: number, currency: string): string {
  return `splitpay://pay?amount=${amount}&currency=${currency}`;
}