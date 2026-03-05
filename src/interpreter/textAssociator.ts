import type { Position } from '@/types/network';
import type { RawText } from './parser';
import type { NodeCandidate } from './snapEngine';
import { TEXT_ASSOCIATION_RADIUS } from '@/utils/constants';
import { distance } from '@/utils/geometry';

export interface TextAssociation {
  textId: string;
  nodeId: string;
  value: number;
  anchorPoint: Position;
}

export interface UnassociatedText {
  textId: string;
  center: Position;
  reason: 'too_far' | 'not_numeric' | 'ambiguous';
}

export interface TextAssociationResult {
  associations: TextAssociation[];
  unassociated: UnassociatedText[];
}

/**
 * Associates numeric text elements with the nearest node (endpoint) within range.
 * Returns demand associations and unassociated text warnings.
 */
export function associateTexts(
  texts: RawText[],
  nodes: NodeCandidate[],
): TextAssociationResult {
  const associations: TextAssociation[] = [];
  const unassociated: UnassociatedText[] = [];

  for (const text of texts) {
    if (text.numericValue === null) {
      unassociated.push({
        textId: text.id,
        center: text.center,
        reason: 'not_numeric',
      });
      continue;
    }

    // Find all nodes within association radius
    const nearby = nodes
      .map((node) => ({
        node,
        dist: distance(text.center, node.position),
      }))
      .filter((n) => n.dist <= TEXT_ASSOCIATION_RADIUS)
      .sort((a, b) => a.dist - b.dist);

    if (nearby.length === 0) {
      unassociated.push({
        textId: text.id,
        center: text.center,
        reason: 'too_far',
      });
    } else {
      // Associate with closest node
      const closest = nearby[0];
      associations.push({
        textId: text.id,
        nodeId: closest.node.id,
        value: text.numericValue,
        anchorPoint: closest.node.position,
      });

      // Warn if ambiguous (multiple nodes within range and close in distance)
      if (
        nearby.length > 1 &&
        nearby[1].dist - closest.dist < 10
      ) {
        unassociated.push({
          textId: text.id,
          center: text.center,
          reason: 'ambiguous',
        });
      }
    }
  }

  return { associations, unassociated };
}
