import type { EdgeMetrics } from '@/types/metrics';
import { METRICS_FLOW_WINDOW, QUEUE_SPEED_THRESHOLD } from '@/utils/constants';

/**
 * Tracks per-edge flow rate (60s sliding window), queue lengths, and max queues.
 */
export class MetricsCollector {
  private departures: Map<string, number[]> = new Map();
  private maxQueues: Map<string, number> = new Map();

  recordDeparture(edgeId: string, time: number): void {
    let list = this.departures.get(edgeId);
    if (!list) {
      list = [];
      this.departures.set(edgeId, list);
    }
    list.push(time);
  }

  computeEdgeMetrics(
    edgeId: string,
    agents: { speed: number }[],
    currentTime: number,
  ): EdgeMetrics {
    const queueLength = agents.filter((a) => a.speed < QUEUE_SPEED_THRESHOLD).length;
    const avgSpeed =
      agents.length > 0
        ? agents.reduce((s, a) => s + a.speed, 0) / agents.length
        : 0;

    // Track max queue
    const prevMax = this.maxQueues.get(edgeId) ?? 0;
    if (queueLength > prevMax) {
      this.maxQueues.set(edgeId, queueLength);
    }

    // Flow rate: departures in last window → vehicles/hour
    const deps = this.departures.get(edgeId);
    let flowRate = 0;
    if (deps) {
      const cutoff = currentTime - METRICS_FLOW_WINDOW;
      while (deps.length > 0 && deps[0] < cutoff) deps.shift();
      flowRate = deps.length * (3600 / METRICS_FLOW_WINDOW);
    }

    return {
      edgeId,
      queueLength,
      flowRate,
      avgSpeed,
      maxQueue: this.maxQueues.get(edgeId) ?? queueLength,
    };
  }
}
