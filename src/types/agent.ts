export interface Agent {
  id: string;
  currentEdge: string;
  positionOnEdge: number;
  speed: number;
  acceleration: number;
  state: 'moving' | 'yielding' | 'stopped';
  desiredSpeed: number;
  waitTime: number;
  spawnTime: number;
  nextEdge: string | null;
  turningProgress: number | null;
}
