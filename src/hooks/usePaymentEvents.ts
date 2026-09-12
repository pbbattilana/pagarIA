import { useEffect, useState } from 'react';
import type { NotificationEvent } from '../types';
import {
  clearPendingPayments,
  getPendingPayments,
  subscribeToPaymentEvents,
  subscribeToSimulatedEvents,
} from '../native/paymentEvents';

/**
 * Subscribes to payment events coming from the native Android layer:
 * live emissions + events captured before the JS app mounted.
 */
export function usePaymentEvents(): NotificationEvent[] {
  const [events, setEvents] = useState<NotificationEvent[]>([]);

  useEffect(() => {
    const push = (event: NotificationEvent) => {
      setEvents(prev => [event, ...prev]);
    };

    getPendingPayments(pending => {
      setEvents(prev => [...new Set([...pending.reverse(), ...prev])]);
    });

    const unsubLive = subscribeToPaymentEvents(push);
    const unsubSim = subscribeToSimulatedEvents(push);

    return () => {
      unsubLive();
      unsubSim();
    };
  }, []);

  return events;
}

/** Clears captured events after the app has consumed them. */
export function useAcknowledgePaymentEvents(): () => void {
  return () => {
    clearPendingPayments();
  };
}