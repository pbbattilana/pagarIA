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

type NativePaymentBubble = {
  showBubble: () => Promise<boolean>;
  hideBubble: () => Promise<void>;
  isOverlayPermissionGranted: () => Promise<boolean>;
  openOverlayPermissionSettings: () => void;
  shareText: (message: string) => void;
  shareImage: (message: string, base64Png: string) => void;
  resizeBubble: (heightDp: number) => void;
};

const module: NativePaymentEvents | undefined =
  Platform.OS === 'android'
    ? (NativeModules.PaymentEvents as NativePaymentEvents)
    : undefined;

const bubbleModule: NativePaymentBubble | undefined =
  Platform.OS === 'android'
    ? (NativeModules.PaymentBubble as NativePaymentBubble)
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

/** Notifies when the user closes the bubble from its native ✕ button. */
export function subscribeToBubbleClose(onClose: () => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('BubbleClose', () => {
    onClose();
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

/** Shows the floating bubble overlay with the split flow. */
export function showBubble(): Promise<boolean> {
  if (!bubbleModule) return Promise.resolve(false);
  return bubbleModule.showBubble();
}

/** Hides the floating bubble overlay. */
export function hideBubble(): Promise<void> {
  if (!bubbleModule) return Promise.resolve();
  return bubbleModule.hideBubble();
}

/** Checks if SYSTEM_ALERT_WINDOW permission is granted. */
export function isOverlayPermissionGranted(): Promise<boolean> {
  if (!bubbleModule) return Promise.resolve(false);
  return bubbleModule.isOverlayPermissionGranted();
}

/** Opens the system settings to grant SYSTEM_ALERT_WINDOW permission. */
export function openOverlayPermissionSettings(): void {
  bubbleModule?.openOverlayPermissionSettings();
}

/** Starts the share sheet from native (works even over other apps). */
export function shareText(message: string): void {
  if (bubbleModule) {
    bubbleModule.shareText(message);
  }
}

/** Shares a base64-encoded PNG of the payment QR via the native share sheet. */
export function shareImage(message: string, base64Png: string): void {
  if (bubbleModule) {
    bubbleModule.shareImage(message, base64Png);
  }
}

/** Asks native to resize the overlay window to fit the given content height. */
export function resizeBubble(heightDp: number): void {
  bubbleModule?.resizeBubble(heightDp);
}
