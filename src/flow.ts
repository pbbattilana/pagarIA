import { createContext, useContext } from 'react';
import type { Payment } from './types';

/**
 * The actions the split flow exposes. Both the deterministic UI and the
 * CopilotKit agent tools drive the SAME actions, so there is exactly one path
 * through the experience regardless of who decides to take it.
 */
export interface FlowApi {
  onPaymentDetected(payment: Payment): void;
  onDismiss(): void;
  onSplit(): void;
  onPeople(people: number): void;
  onGenerateCharges(): void;
  onReset(): void;
}

export interface FlowValue {
  state: import('./useSplitFlow').SplitState;
  api: FlowApi;
}

export const FlowContext = createContext<FlowValue | null>(null);

export function useFlow(): FlowValue {
  const flow = useContext(FlowContext);
  if (!flow) {
    throw new Error('useFlow must be used within FlowContext.Provider');
  }
  return flow;
}