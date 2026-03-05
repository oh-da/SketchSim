export interface EdgeMetrics {
  edgeId: string;
  queueLength: number;
  flowRate: number;
  avgSpeed: number;
  maxQueue: number;
}

export interface GlobalMetrics {
  totalVehicles: number;
  totalCompleted: number;
  avgNetworkSpeed: number;
  simClock: number;
}
