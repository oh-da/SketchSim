import type { RawEllipse, RawText } from './parser';
import type { NodeCandidate } from './snapEngine';
import { SIGNAL_ASSOCIATION_RADIUS, DEFAULT_CYCLE_TIME } from '@/utils/constants';
import { distance } from '@/utils/geometry';

export interface SignalAssignment {
  nodeId: string;
  cycleTime: number;
}

/**
 * Detects signalized intersections by finding ellipses near nodes.
 * Parses cycle time from text elements inside/near the ellipse.
 */
export function detectSignals(
  ellipses: RawEllipse[],
  texts: RawText[],
  nodes: NodeCandidate[],
): SignalAssignment[] {
  const assignments: SignalAssignment[] = [];

  for (const ellipse of ellipses) {
    // Find nearest node within radius
    let nearestNode: NodeCandidate | null = null;
    let nearestDist = Infinity;

    for (const node of nodes) {
      const d = distance(ellipse.center, node.position);
      if (d <= SIGNAL_ASSOCIATION_RADIUS && d < nearestDist) {
        nearestDist = d;
        nearestNode = node;
      }
    }

    if (!nearestNode) continue;

    // Check for cycle time text inside or near the ellipse
    let cycleTime = DEFAULT_CYCLE_TIME;
    const ellipsePadding = 10;

    for (const text of texts) {
      if (text.numericValue === null) continue;
      // Check if text center is within the ellipse bounds + padding
      const dx = (text.center.x - ellipse.center.x) / (ellipse.radiusX + ellipsePadding);
      const dy = (text.center.y - ellipse.center.y) / (ellipse.radiusY + ellipsePadding);
      if (dx * dx + dy * dy <= 1) {
        cycleTime = text.numericValue;
        break;
      }
    }

    // Avoid duplicate assignments to the same node
    if (!assignments.some((a) => a.nodeId === nearestNode!.id)) {
      assignments.push({ nodeId: nearestNode.id, cycleTime });
    }
  }

  return assignments;
}
