import { useSyncExternalStore } from 'react';
import type { Payment, SplitRequest } from '../types';
import { amountPerPerson, buildPaymentPayload } from '../split';

export type SplitState =
  | { status: 'idle' }
  | { status: 'detected'; payment: Payment }
  | { status: 'people'; payment: Payment }
  | { status: 'summary'; payment: Payment; people: number; amountPerPerson: number }
  | { status: 'ready'; split: SplitRequest };

type Listener = () => void;

let currentState: SplitState = { status: 'idle' };
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SplitState {
  return currentState;
}

function emit(next: SplitState) {
  currentState = next;
  listeners.forEach(l => l());
}

export const flowActions = {
  onPaymentDetected(payment: Payment) {
    emit({ status: 'detected', payment });
  },

  onSplit() {
    if (currentState.status === 'detected') {
      emit({ status: 'people', payment: currentState.payment });
    }
  },

  onPeople(people: number) {
    if (currentState.status === 'people') {
      const per = amountPerPerson(currentState.payment.amount, people);
      emit({ status: 'summary', payment: currentState.payment, people, amountPerPerson: per });
    }
  },

  onGenerateCharges() {
    if (currentState.status === 'summary') {
      const split: SplitRequest = {
        payment: currentState.payment,
        people: currentState.people,
        amountPerPerson: currentState.amountPerPerson,
        payload: buildPaymentPayload(currentState.amountPerPerson, currentState.payment.currency),
      };
      emit({ status: 'ready', split });
    }
  },

  onDismiss() {
    emit({ status: 'idle' });
  },

  onReset() {
    emit({ status: 'idle' });
  },
};

export function useFlowStore(): { state: SplitState; api: typeof flowActions } {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return { state, api: flowActions };
}
