import type { Position } from '@/types/network';
import type { RawSegment } from './parser';
import {
  AUTO_SNAP_DISTANCE,
  SUGGEST_SNAP_DISTANCE,
  INTERSECTION_TOLERANCE,
} from '@/utils/constants';
import { distance, lineIntersection, nearestPointOnSegment, pointToSegmentDistance } from '@/utils/geometry';

export interface NodeCandidate {
  id: string;
  position: Position;
  mergedEndpoints: EndpointRef[];
  type: 'endpoint' | 'intersection';
}

export interface EndpointRef {
  segmentId: string;
  which: 'start' | 'end' | 'crossing';
}

export interface SnapSuggestion {
  point1: Position;
  point2: Position;
  distance: number;
  segmentIds: [string, string];
}

export interface SnapResult {
  nodes: NodeCandidate[];
  suggestions: SnapSuggestion[];
}

interface CandidatePoint {
  position: Position;
  ref: EndpointRef;
  clusterId: number;
}

/**
 * Two-tier snap engine:
 * - Points within AUTO_SNAP_DISTANCE (10px) are merged into a single node.
 * - Points between AUTO_SNAP and SUGGEST_SNAP (10-20px) generate a ghost suggestion.
 */
export function snapEndpoints(segments: RawSegment[]): SnapResult {
  // Collect all candidate points: segment endpoints + line-line crossings
  const candidates: CandidatePoint[] = [];

  // Add segment endpoints
  for (const seg of segments) {
    candidates.push({
      position: seg.startPoint,
      ref: { segmentId: seg.id, which: 'start' },
      clusterId: -1,
    });
    candidates.push({
      position: seg.endPoint,
      ref: { segmentId: seg.id, which: 'end' },
      clusterId: -1,
    });
  }

  // Detect T-intersections: endpoint near another segment's body
  for (const seg of segments) {
    for (const endpoint of [
      { pos: seg.startPoint, which: 'start' as const },
      { pos: seg.endPoint, which: 'end' as const },
    ]) {
      for (const other of segments) {
        if (other.id === seg.id) continue;
        for (let k = 0; k < other.points.length - 1; k++) {
          const d = pointToSegmentDistance(endpoint.pos, other.points[k], other.points[k + 1]);
          if (d <= AUTO_SNAP_DISTANCE) {
            // Project onto the other segment to get the T-junction point
            const projected = nearestPointOnSegment(endpoint.pos, other.points[k], other.points[k + 1]);
            // Don't add if too close to existing endpoints of the other segment
            const nearOtherEndpoint =
              distance(projected, other.startPoint) < INTERSECTION_TOLERANCE ||
              distance(projected, other.endPoint) < INTERSECTION_TOLERANCE;
            if (!nearOtherEndpoint) {
              const tooClose = candidates.some(
                (c) => c.ref.segmentId === other.id && c.ref.which === 'crossing' && distance(c.position, projected) < INTERSECTION_TOLERANCE,
              );
              if (!tooClose) {
                candidates.push({
                  position: projected,
                  ref: { segmentId: other.id, which: 'crossing' },
                  clusterId: -1,
                });
              }
            }
          }
        }
      }
    }
  }

  // Detect line-line crossings
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const segA = segments[i];
      const segB = segments[j];
      // Check each sub-segment pair for crossings
      for (let ai = 0; ai < segA.points.length - 1; ai++) {
        for (let bi = 0; bi < segB.points.length - 1; bi++) {
          const ix = lineIntersection(
            segA.points[ai],
            segA.points[ai + 1],
            segB.points[bi],
            segB.points[bi + 1],
          );
          if (ix) {
            // Check it's not too close to an existing candidate (avoid duplicates near endpoints)
            const tooClose = candidates.some(
              (c) => distance(c.position, ix) < INTERSECTION_TOLERANCE,
            );
            if (!tooClose) {
              candidates.push({
                position: ix,
                ref: { segmentId: segA.id, which: 'crossing' },
                clusterId: -1,
              });
              candidates.push({
                position: ix,
                ref: { segmentId: segB.id, which: 'crossing' },
                clusterId: -1,
              });
            }
          }
        }
      }
    }
  }

  // Greedy clustering: merge points within AUTO_SNAP_DISTANCE
  let nextCluster = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].clusterId >= 0) continue;
    candidates[i].clusterId = nextCluster;

    // Find all unassigned points within snap distance of this cluster
    // Iterate repeatedly to handle transitive merges
    let changed = true;
    while (changed) {
      changed = false;
      const clusterPoints = candidates.filter(
        (c) => c.clusterId === nextCluster,
      );
      const centroid = computeCentroid(clusterPoints.map((c) => c.position));

      for (let j = i + 1; j < candidates.length; j++) {
        if (candidates[j].clusterId >= 0) continue;
        if (distance(centroid, candidates[j].position) <= AUTO_SNAP_DISTANCE) {
          candidates[j].clusterId = nextCluster;
          changed = true;
        }
      }
    }
    nextCluster++;
  }

  // Build nodes from clusters
  const clusterMap = new Map<number, CandidatePoint[]>();
  for (const c of candidates) {
    const list = clusterMap.get(c.clusterId) ?? [];
    list.push(c);
    clusterMap.set(c.clusterId, list);
  }

  const nodes: NodeCandidate[] = [];
  let nodeIdCounter = 0;

  for (const [, points] of clusterMap) {
    const centroid = computeCentroid(points.map((p) => p.position));
    const refs = points.map((p) => p.ref);
    const uniqueSegments = new Set(refs.map((r) => r.segmentId));
    const hasCrossing = refs.some((r) => r.which === 'crossing');

    nodes.push({
      id: `node_${nodeIdCounter++}`,
      position: centroid,
      mergedEndpoints: refs,
      type:
        hasCrossing || uniqueSegments.size >= 3
          ? 'intersection'
          : uniqueSegments.size >= 2
            ? 'intersection'
            : 'endpoint',
    });
  }

  // Find snap suggestions: unmerged node pairs between 10-20px
  const suggestions: SnapSuggestion[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = distance(nodes[i].position, nodes[j].position);
      if (d > AUTO_SNAP_DISTANCE && d <= SUGGEST_SNAP_DISTANCE) {
        const segI = nodes[i].mergedEndpoints[0]?.segmentId;
        const segJ = nodes[j].mergedEndpoints[0]?.segmentId;
        if (segI && segJ && segI !== segJ) {
          suggestions.push({
            point1: nodes[i].position,
            point2: nodes[j].position,
            distance: d,
            segmentIds: [segI, segJ],
          });
        }
      }
    }
  }

  return { nodes, suggestions };
}

function computeCentroid(positions: Position[]): Position {
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length,
  };
}
