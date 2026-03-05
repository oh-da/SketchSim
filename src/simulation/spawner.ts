import type { NetworkEdge } from '@/types/network';

/**
 * Poisson arrival process spawner.
 * For each edge with demand, schedules arrivals using exponential inter-arrival times.
 */
export class PoissonSpawner {
  private nextArrival: Map<string, number> = new Map();
  private demands: Map<string, number> = new Map();

  constructor(edges: NetworkEdge[]) {
    for (const edge of edges) {
      if (edge.demand !== null && edge.demand > 0) {
        this.demands.set(edge.id, edge.demand);
        this.scheduleNext(edge.id, 0, edge.demand);
      }
    }
  }

  /** Returns edge IDs that should spawn a vehicle at the current time */
  getSpawns(currentTime: number): string[] {
    const spawns: string[] = [];

    for (const [edgeId, arrivalTime] of this.nextArrival) {
      if (currentTime >= arrivalTime) {
        spawns.push(edgeId);
        const demand = this.demands.get(edgeId)!;
        this.scheduleNext(edgeId, currentTime, demand);
      }
    }

    return spawns;
  }

  private scheduleNext(edgeId: string, currentTime: number, demand: number): void {
    const lambda = demand / 3600; // arrivals per second
    const dt = -Math.log(Math.random()) / lambda;
    this.nextArrival.set(edgeId, currentTime + dt);
  }
}
