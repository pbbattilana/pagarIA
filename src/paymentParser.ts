import type { Currency, NotificationEvent, Payment } from './types';

/**
 * Deterministic, regex-based parser for the notification formats SplitPay has
 * to recognize in the MVP. Designed so additional provider formats can be
 * added later (pattern list + currency map) without changing the pipeline.
 */

const AMOUNT_PATTERN = /(₲|Gs\.?|PYG|USD|\$)\s*([\d.,\u00A0]+)/i;

const CURRENCY_BY_TOKEN: Record<string, Currency> = {
  '₲': 'PYG',
  gs: 'PYG',
  pyg: 'PYG',
  $: 'USD',
  usd: 'USD',
};

function mapCurrency(token: string): Currency {
  const key = token.replace(/\.$/, '').toLowerCase();
  return CURRENCY_BY_TOKEN[key] ?? 'PYG';
}

/**
 * Normalizes an amount string to a number.
 * - "240.000" / "240.0000" style three-digit groups are thousands separators.
 * - "340,50" style comma is a decimal separator.
 */
export function parseAmount(raw: string): number {
  const value = raw.replace(/[\s\u00A0]/g, '');

  if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    return Math.round(Number(value.replace(/\./g, '')));
  }

  const commaDecimal = value.replace(/,/g, '.');
  const parsed = Number(commaDecimal);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
}

function extractMerchant(rest: string): string | undefined {
  const cleaned = rest.replace(/^[\s\-–—:]+/, '').replace(/[\s\-–—]+$/, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Cheap deterministic check that a notification might represent a payment. */
export function looksLikePayment(event: NotificationEvent): boolean {
  const text = `${event.text ?? ''} ${event.title ?? ''}`;
  return AMOUNT_PATTERN.test(text);
}

/** Parses a raw NotificationEvent into a normalized Payment, or null. */
export function parsePayment(event: NotificationEvent): Payment | null {
  const text = (event.text ?? '').trim() || (event.title ?? '').trim();
  if (!text) return null;

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return null;

  const amount = parseAmount(match[2]);
  if (!Number.isFinite(amount)) return null;

  const after = text.slice(match.index + match[0].length).trim();

  return {
    amount,
    currency: mapCurrency(match[1]),
    merchant: extractMerchant(after),
    timestamp: event.timestamp,
    source: {
      packageName: event.packageName,
      title: event.title,
      text: event.text,
    },
  };
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
  PYG: '₲',
  USD: 'US$',
};

/** Formats an amount for display, e.g. ₲60.000 */
export function formatAmount(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString('es-PY')}`;
}