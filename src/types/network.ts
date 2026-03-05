export interface Position {
  x: number;
  y: number;
}

export interface NetworkNode {
  id: string;
  position: Position;
  type: 'endpoint' | 'intersection';
  signalized: boolean;
  cycleTime: number | null;
  phases: SignalPhase[];
  priorityEdges: string[];
  connectedEdges: string[];
}

export interface NetworkEdge {
  id: string;
  fromNode: string;
  toNode: string;
  points: Position[];
  lengthMeters: number;
  demand: number | null;
  freeFlowSpeed: number;
  turningRatios: Map<string, number>;
  bearing: number;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  scale: number;
  metadata: {
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    elementCount: number;
    warnings: InterpreterWarning[];
  };
}

export interface InterpreterWarning {
  type: 'ambiguous_text' | 'near_miss_snap' | 'disconnected' | 'no_demand';
  message: string;
  position: Position;
  elementIds: string[];
}

export interface SignalPhase {
  id: string;
  edgeIds: string[];
  greenDuration: number;
}
