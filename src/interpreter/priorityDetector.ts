import type { NetworkEdge } from '@/types/network';
import { angleDifference } from '@/utils/geometry';
import { MAJOR_ROAD_ANGLE_THRESHOLD } from '@/utils/constants';

/**
 * Detect the major road (priority edges) at an intersection node.
 *
 * Finds the pair of edges with the smallest mutual angle difference
 * (most aligned = through-road). If that angle < 30°, those edges
 * form the major road and get priority.
 *
 * Returns the IDs of priority edges, or empty array if no clear major road.
 */
export function detectPriority(connectedEdges: NetworkEdge[]): string[] {
  if (connectedEdges.length < 3) return [];

  let bestPair: [string, string] | null = null;
  let bestAngle = Infinity;

  for (let i = 0; i < connectedEdges.length; i++) {
    for (let j = i + 1; j < connectedEdges.length; j++) {
      const diff = Math.abs(
        angleDifference(connectedEdges[i].bearing, connectedEdges[j].bearing),
      );
      // We want edges going in opposite directions (most aligned through-road)
      // So we check how close the angle difference is to 180°
      const alignmentError = Math.abs(diff - 180);
      if (alignmentError < bestAngle) {
        bestAngle = alignmentError;
        bestPair = [connectedEdges[i].id, connectedEdges[j].id];
      }
    }
  }

  if (bestPair && bestAngle < MAJOR_ROAD_ANGLE_THRESHOLD) {
    return bestPair;
  }

  // No clear major road — all-way stop behavior
  return [];
}
