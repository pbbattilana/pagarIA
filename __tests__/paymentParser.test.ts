import { looksLikePayment, parseAmount, parsePayment } from '../src/paymentParser';
import { amountPerPerson, buildPaymentPayload } from '../src/split';
import type { NotificationEvent } from '../src/types';

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    packageName: 'com.bank.demo',
    title: 'Compra aprobada',
    text: '₲240.000 - La Cabrera',
    timestamp: 1700000000000,
    ...overrides,
  };
}

describe('parseAmount', () => {
  it('parses thousands separators', () => {
    expect(parseAmount('240.000')).toBe(240000);
  });

  it('parses plain integers', () => {
    expect(parseAmount('240000')).toBe(240000);
  });

  it('parses comma decimals', () => {
    expect(parseAmount('340,50')).toBe(341);
  });
});

describe('looksLikePayment', () => {
  it('recognizes guaraní symbols', () => {
    expect(looksLikePayment(event({ text: '₲240.000 - La Cabrera' }))).toBe(true);
  });

  it('recognizes Gs prefixes', () => {
    expect(looksLikePayment(event({ text: 'Gs. 300.000 - Shell' }))).toBe(true);
  });

  it('rejects plain messages', () => {
    expect(looksLikePayment(event({ text: 'Tu token de seguridad es 1234' }))).toBe(false);
  });
});

describe('parsePayment', () => {
  it('parses ₲240.000 - La Cabrera', () => {
    const parsed = parsePayment(event());
    expect(parsed).toEqual({
      amount: 240000,
      currency: 'PYG',
      merchant: 'La Cabrera',
      timestamp: 1700000000000,
      source: {
        packageName: 'com.bank.demo',
        title: 'Compra aprobada',
        text: '₲240.000 - La Cabrera',
      },
    });
  });

  it('parses Gs. without dot', () => {
    const parsed = parsePayment(event({ text: 'Gs 300.000 - Shell Loma' }));
    expect(parsed?.amount).toBe(300000);
    expect(parsed?.currency).toBe('PYG');
    expect(parsed?.merchant).toBe('Shell Loma');
  });

  it('parses PYG with no separators', () => {
    const parsed = parsePayment(event({ text: 'PYG 450000 - Stock' }));
    expect(parsed?.amount).toBe(450000);
    expect(parsed?.merchant).toBe('Stock');
  });

  it('parses USD', () => {
    const parsed = parsePayment(event({ text: 'USD 120,50 - Starbucks' }));
    expect(parsed?.amount).toBe(121);
    expect(parsed?.currency).toBe('USD');
  });

  it('returns null when no currency/amount present', () => {
    expect(parsePayment(event({ text: 'Alarma de reunión a las 15:00' }))).toBeNull();
  });
});

describe('split math', () => {
  it('computes amount per person deterministically', () => {
    expect(amountPerPerson(240000, 4)).toBe(60000);
  });

  it('builds the demo payment payload', () => {
    expect(buildPaymentPayload(60000, 'PYG')).toBe('splitpay://pay?amount=60000&currency=PYG');
  });
});