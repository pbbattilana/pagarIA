import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { NotificationEvent } from '../types';

type NativePaymentEvents = {
  getPendingPayments: (
    callback: (events: NotificationEvent[]) => void,
  ) => void;
  clearPendingPayments: () => void;
  hasNotificationAccess: (callback: (granted: boolean) => void) => void;
  openNotificationAccessSettings: () => void;
  simulatePayment: (text: string) => void;
};

const module: NativePaymentEvents | undefined =
  Platform.OS === 'android'
    ? (NativeModules.PaymentEvents as NativePaymentEvents)
    : undefined;

const emitter = module ? new NativeEventEmitter(NativeModules.PaymentEvents) : null;

/** Subscribes to live PaymentEvent emissions from the native layer. */
export function subscribeToPaymentEvents(
  onEvent: (event: NotificationEvent) => void,
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('PaymentEvent', payload => {
    onEvent(payload as unknown as NotificationEvent);
  });
  return () => sub.remove();
}

/** Pulls any notifications captured before the JS app mounted. */
export function getPendingPayments(callback: (events: NotificationEvent[]) => void): void {
  if (!module) {
    callback([]);
    return;
  }
  module.getPendingPayments(callback);
}

export function clearPendingPayments(): void {
  module?.clearPendingPayments();
}

export function hasNotificationAccess(callback: (granted: boolean) => void): void {
  if (!module) {
    callback(false);
    return;
  }
  module.hasNotificationAccess(callback);
}

export function openNotificationAccessSettings(): void {
  module?.openNotificationAccessSettings();
}

/** Demo path: produces the exact same event flow as a real notification. */
export function simulatePayment(text: string): void {
  if (!module) {
    // Non-Android or missing native module: synthesize locally so the demo
    // still works on other platforms / detection setups.
    handleSyntheticPayment(text);
    return;
  }
  module.simulatePayment(text);
}

const FORWARD_BUS = new Set<(event: NotificationEvent) => void>();

function handleSyntheticPayment(text: string): void {
  const event: NotificationEvent = {
    packageName: 'com.splitpay.demo',
    title: 'Compra aprobada',
    text,
    timestamp: Date.now(),
  };
  FORWARD_BUS.forEach(cb => cb(event));
}

/** Local fallback bus used when the native module is unavailable. */
export function subscribeToSimulatedEvents(onEvent: (event: NotificationEvent) => void): () => void {
  FORWARD_BUS.add(onEvent);
  return () => {
    FORWARD_BUS.delete(onEvent);
  };
}