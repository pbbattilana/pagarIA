/**
 * Raw notification event produced by the native layer. Every source — the
 * NotificationListenerService or SimulatePayment — converges on this shape.
 */
export interface NotificationEvent {
  packageName: string;
  title?: string;
  text?: string;
  timestamp: number;
}

export type Currency = 'PYG' | 'USD';

/**
 * Normalized payment extracted from a NotificationEvent.
 */
export interface Payment {
  amount: number;
  currency: Currency;
  merchant?: string;
  timestamp: number;
  source: {
    packageName: string;
    title?: string;
    text?: string;
  };
}

/** Split decision produced by the deterministic split flow. */
export interface SplitRequest {
  payment: Payment;
  people: number;
  amountPerPerson: number;
  payload: string;
}