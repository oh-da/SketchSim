import type { Position } from '@/types/network';
import { quadraticBezier, distance } from '@/utils/geometry';

/**
 * Compute position and bearing for an agent turning through an intersection.
 * Uses a quadratic Bezier: P0 (edge end) → P1 (node center) → P2 (next edge start).
 */
export function getTurnPosition(
  edgeEnd: Position,
  nodePos: Position,
  nextEdgeStart: Position,
  t: number,
): { position: Position; bearing: number } {
  const position = quadraticBezier(edgeEnd, nodePos, nextEdgeStart, t);

  // Tangent of quadratic Bezier: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
  const tx = 2 * (1 - t) * (nodePos.x - edgeEnd.x) + 2 * t * (nextEdgeStart.x - nodePos.x);
  const ty = 2 * (1 - t) * (nodePos.y - edgeEnd.y) + 2 * t * (nextEdgeStart.y - nodePos.y);

  // Convert tangent to compass bearing (screen coords: Y down)
  const rad = Math.atan2(tx, -ty);
  const bearing = ((rad * 180) / Math.PI + 360) % 360;

  return { position, bearing };
}

/**
 * Estimate arc length in pixels (chord approximation: P0→P1 + P1→P2).
 */
export function estimateTurnArcPx(
  edgeEnd: Position,
  nodePos: Position,
  nextEdgeStart: Position,
): number {
  return distance(edgeEnd, nodePos) + distance(nodePos, nextEdgeStart);
}
