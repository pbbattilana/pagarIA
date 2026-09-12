import { useCallback, useMemo, useState } from 'react';
import type { FlowApi } from './flow';
import type { Payment, SplitRequest } from './types';
import { amountPerPerson, buildPaymentPayload } from './split';

export type SplitState =
  | { status: 'idle' }
  | { status: 'detected'; payment: Payment }
  | { status: 'people'; payment: Payment }
  | { status: 'summary'; payment: Payment; people: number; amountPerPerson: number }
  | { status: 'ready'; split: SplitRequest };

/**
 * Deterministic state machine behind the split experience. The CopilotKit
 * agent decides *which* state to reach and renders the matching UI; every
 * reachable state is reached through this controller so the demo never depends
 * on the network.
 */
export function useSplitFlow(): {
  state: SplitState;
  flowApi: FlowApi;
} {
  const [state, setState] = useState<SplitState>({ status: 'idle' });

  const onPaymentDetected = useCallback((payment: Payment) => {
    setState({ status: 'detected', payment });
  }, []);

  const onDismiss = useCallback(() => setState({ status: 'idle' }), []);

  const onSplit = useCallback(() => {
    setState(prev =>
      prev.status === 'detected' ? { status: 'people', payment: prev.payment } : prev,
    );
  }, []);

  const onPeople = useCallback((people: number) => {
    setState(prev => {
      if (prev.status !== 'people') return prev;
      const per = amountPerPerson(prev.payment.amount, people);
      return { status: 'summary', payment: prev.payment, people, amountPerPerson: per };
    });
  }, []);

  const onGenerateCharges = useCallback(() => {
    setState(prev => {
      if (prev.status !== 'summary') return prev;
      const split: SplitRequest = {
        payment: prev.payment,
        people: prev.people,
        amountPerPerson: prev.amountPerPerson,
        payload: buildPaymentPayload(prev.amountPerPerson, prev.payment.currency),
      };
      return { status: 'ready', split };
    });
  }, []);

  const onReset = useCallback(() => setState({ status: 'idle' }), []);

  const flowApi: FlowApi = useMemo(
    () => ({
      onPaymentDetected,
      onDismiss,
      onSplit,
      onPeople,
      onGenerateCharges,
      onReset,
    }),
    [onPaymentDetected, onDismiss, onSplit, onPeople, onGenerateCharges, onReset],
  );

  return { state, flowApi };
}