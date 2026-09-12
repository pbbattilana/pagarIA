import { useFlowStore, type SplitState, flowActions } from './bubble/flowStore';

export type { SplitState };
export type { flowActions as FlowApi };

export const FlowContext = null;

export function useFlow() {
  return useFlowStore();
}
