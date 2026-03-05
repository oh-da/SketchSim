export interface SignalState {
  nodeId: string;
  currentPhaseIndex: number;
  timeInPhase: number;
  isGreen: (edgeId: string) => boolean;
}
