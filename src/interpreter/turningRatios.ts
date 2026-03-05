import type { NetworkEdge } from '@/types/network';
import { angleDifference } from '@/utils/geometry';
import {
  TURN_RATIO_STRAIGHT,
  TURN_RATIO_RIGHT,
  TURN_RATIO_LEFT,
  STRAIGHT_ANGLE_THRESHOLD,
  UTURN_ANGLE_THRESHOLD,
} from '@/utils/constants';

type TurnCategory = 'straight' | 'right' | 'left' | 'uturn';

/**
 * Compute geometry-based turning ratios for an incoming edge at a node.
 * Returns a map of exitEdgeId → probability.
 *
 * Compares each outgoing edge's bearing against the incoming bearing:
 * - Straight: outgoing continues same direction (|Δθ| < 30°)
 * - Right: clockwise deviation (30°–150°)
 * - Left: counter-clockwise deviation (-30° to -150°)
 * - U-turn: reversal (|Δθ| ≥ 150°)
 */
export function computeTurningRatios(
  incomingBearing: number,
  outgoingEdges: NetworkEdge[],
): Map<string, number> {
  if (outgoingEdges.length === 0) return new Map();
  if (outgoingEdges.length === 1) {
    return new Map([[outgoingEdges[0].id, 1.0]]);
  }

  // Classify each outgoing edge by angle relative to incoming direction
  const classified: { edge: NetworkEdge; category: TurnCategory }[] = [];

  for (const edge of outgoingEdges) {
    const delta = angleDifference(incomingBearing, edge.bearing);
    const absDelta = Math.abs(delta);

    let category: TurnCategory;
    if (absDelta < STRAIGHT_ANGLE_THRESHOLD) {
      category = 'straight';
    } else if (absDelta >= UTURN_ANGLE_THRESHOLD) {
      category = 'uturn';
    } else if (delta > 0) {
      // Positive delta = clockwise = right turn
      category = 'right';
    } else {
      category = 'left';
    }

    classified.push({ edge, category });
  }

  // Base probabilities per category (U-turns get 0)
  const baseProbabilities: Record<TurnCategory, number> = {
    straight: TURN_RATIO_STRAIGHT,
    right: TURN_RATIO_RIGHT,
    left: TURN_RATIO_LEFT,
    uturn: 0,
  };

  // Count edges per category (excluding u-turns)
  const categoryCounts: Record<TurnCategory, number> = {
    straight: 0,
    right: 0,
    left: 0,
    uturn: 0,
  };
  for (const c of classified) {
    categoryCounts[c.category]++;
  }

  // Redistribute missing categories' probability proportionally
  const activeCategories = (['straight', 'right', 'left'] as TurnCategory[]).filter(
    (cat) => categoryCounts[cat] > 0,
  );

  const totalActiveBase = activeCategories.reduce(
    (sum, cat) => sum + baseProbabilities[cat],
    0,
  );

  // Assign probabilities
  const ratios = new Map<string, number>();

  for (const { edge, category } of classified) {
    if (category === 'uturn') {
      ratios.set(edge.id, 0);
      continue;
    }

    // Redistribute: this category's share = baseProb / totalActiveBase, split among edges in category
    const redistributed =
      totalActiveBase > 0 ? baseProbabilities[category] / totalActiveBase : 0;
    const perEdge = redistributed / categoryCounts[category];
    ratios.set(edge.id, perEdge);
  }

  // Normalize to ensure sum = 1.0
  const total = Array.from(ratios.values()).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const [id, val] of ratios) {
      ratios.set(id, val / total);
    }
  }

  return ratios;
}
