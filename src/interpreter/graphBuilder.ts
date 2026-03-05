import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  NetworkGraph,
  NetworkNode,
  NetworkEdge,
  Position,
} from '@/types/network';
import {
  DEFAULT_SCALE,
  DEFAULT_FREE_FLOW_SPEED,
  DEFAULT_DEMAND,
  DEFAULT_CYCLE_TIME,
} from '@/utils/constants';
import { bearing, polylineLength, distance, angleDifference } from '@/utils/geometry';
import { parseElements } from './parser';
import { snapEndpoints, type SnapResult, type NodeCandidate } from './snapEngine';
import { associateTexts, type UnassociatedText } from './textAssociator';
import { detectSignals } from './signalDetector';
import { computeTurningRatios } from './turningRatios';
import { detectPriority } from './priorityDetector';
import { validateGraph } from './validator';

export interface BuildResult {
  graph: NetworkGraph;
  suggestions: SnapResult['suggestions'];
  unassociatedTexts: UnassociatedText[];
}

let edgeIdCounter = 0;

/**
 * Main interpreter pipeline: Excalidraw elements → NetworkGraph.
 */
export function buildGraph(
  elements: readonly ExcalidrawElement[],
  scale: number = DEFAULT_SCALE,
): BuildResult {
  edgeIdCounter = 0;

  // Step 1: Parse elements
  const { segments, texts, ellipses } = parseElements(elements);

  if (segments.length === 0) {
    return {
      graph: emptyGraph(scale),
      suggestions: [],
      unassociatedTexts: [],
    };
  }

  // Step 2: Snap endpoints → nodes
  const snapResult = snapEndpoints(segments);
  const { nodes: nodeCandidates, suggestions } = snapResult;

  // Step 3: Build directed edges between nodes
  const edges = buildEdges(segments, nodeCandidates, scale);

  // Step 4: Associate text → demand on edges (via nearest node)
  const { associations, unassociated: unassociatedTexts } = associateTexts(
    texts,
    nodeCandidates,
  );

  // Apply demand associations: text associated to a node sets demand on
  // incoming edges to that node (edges where toNode = associated node)
  for (const assoc of associations) {
    // Find edges whose fromNode matches (demand enters from source endpoint)
    const edgesFromNode = edges.filter((e) => e.fromNode === assoc.nodeId);
    for (const edge of edgesFromNode) {
      edge.demand = assoc.value;
    }
    // If no edges from this node, try edges to this node
    if (edgesFromNode.length === 0) {
      const edgesToNode = edges.filter((e) => e.toNode === assoc.nodeId);
      for (const edge of edgesToNode) {
        edge.demand = assoc.value;
      }
    }
  }

  // Step 5: Default demand if none assigned
  const hasAnyDemand = edges.some((e) => e.demand !== null && e.demand > 0);
  if (!hasAnyDemand) {
    // Only set default on edges starting from endpoint nodes (entry points)
    for (const edge of edges) {
      const fromNode = nodeCandidates.find((n) => n.id === edge.fromNode);
      if (fromNode?.type === 'endpoint') {
        edge.demand = DEFAULT_DEMAND;
      }
    }
  }

  // Step 6: Detect signals
  const signalAssignments = detectSignals(ellipses, texts, nodeCandidates);

  // Step 7: Build full NetworkNodes
  const networkNodes: NetworkNode[] = nodeCandidates.map((nc) => {
    const connEdges = edges.filter(
      (e) => e.fromNode === nc.id || e.toNode === nc.id,
    );
    const connectedEdgeIds = connEdges.map((e) => e.id);
    const signal = signalAssignments.find((s) => s.nodeId === nc.id);

    return {
      id: nc.id,
      position: nc.position,
      type: nc.type,
      signalized: !!signal,
      cycleTime: signal?.cycleTime ?? null,
      phases: [],
      priorityEdges: [],
      connectedEdges: connectedEdgeIds,
    };
  });

  // Step 8: Compute priority and signal phases per intersection node
  for (const node of networkNodes) {
    if (node.type !== 'intersection') continue;
    const connEdges = edges.filter(
      (e) => e.fromNode === node.id || e.toNode === node.id,
    );

    // Priority detection
    node.priorityEdges = detectPriority(connEdges);

    // Signal phase clustering
    if (node.signalized) {
      node.phases = buildSignalPhases(
        node,
        edges.filter((e) => e.toNode === node.id),
      );
    }
  }

  // Step 9: Compute turning ratios per edge at each node
  for (const edge of edges) {
    const toNode = networkNodes.find((n) => n.id === edge.toNode);
    if (!toNode || toNode.type !== 'intersection') continue;

    const outgoing = edges.filter(
      (e) => e.fromNode === toNode.id && e.id !== edge.id,
    );
    if (outgoing.length === 0) continue;

    const incomingBearing = edge.bearing;
    edge.turningRatios = computeTurningRatios(incomingBearing, outgoing);
  }

  // Step 10: Compute bounds
  const allPositions = networkNodes.map((n) => n.position);
  const bounds = {
    minX: Math.min(...allPositions.map((p) => p.x)),
    minY: Math.min(...allPositions.map((p) => p.y)),
    maxX: Math.max(...allPositions.map((p) => p.x)),
    maxY: Math.max(...allPositions.map((p) => p.y)),
  };

  const graph: NetworkGraph = {
    nodes: networkNodes,
    edges,
    scale,
    metadata: {
      bounds,
      elementCount: elements.length,
      warnings: [],
    },
  };

  // Step 11: Validate
  graph.metadata.warnings = validateGraph(graph);

  return { graph, suggestions, unassociatedTexts };
}

/**
 * Build directed edges from segments and node candidates.
 * For arrows: single direction. For plain lines: both directions.
 */
function buildEdges(
  segments: ReturnType<typeof parseElements>['segments'],
  nodes: NodeCandidate[],
  scale: number,
): NetworkEdge[] {
  const edges: NetworkEdge[] = [];

  for (const seg of segments) {
    // Find the nodes at this segment's start and end
    const startNode = findNodeForEndpoint(seg.startPoint, seg.id, 'start', nodes);
    const endNode = findNodeForEndpoint(seg.endPoint, seg.id, 'end', nodes);

    if (!startNode || !endNode || startNode.id === endNode.id) continue;

    // Also find intermediate intersection nodes that split this segment
    const intermediateNodes = findIntermediateNodes(seg, nodes, startNode, endNode);
    const orderedNodes = [startNode, ...intermediateNodes, endNode];

    // Create edges between consecutive nodes
    for (let i = 0; i < orderedNodes.length - 1; i++) {
      const from = orderedNodes[i];
      const to = orderedNodes[i + 1];
      const subPoints = extractSubPolyline(seg.points, from.position, to.position);

      if (subPoints.length < 2) continue;

      const lengthPx = polylineLength(subPoints);
      const lengthMeters = lengthPx * scale;
      const edgeBearing = bearing(subPoints[0], subPoints[subPoints.length - 1]);

      // Forward edge
      edges.push({
        id: `edge_${edgeIdCounter++}`,
        fromNode: from.id,
        toNode: to.id,
        points: subPoints,
        lengthMeters,
        demand: null,
        freeFlowSpeed: DEFAULT_FREE_FLOW_SPEED,
        turningRatios: new Map(),
        bearing: edgeBearing,
      });

      // Reverse edge (unless arrow — arrows are one-way)
      if (!seg.isArrow) {
        const reversePoints = [...subPoints].reverse();
        const reverseBearing = bearing(
          reversePoints[0],
          reversePoints[reversePoints.length - 1],
        );
        edges.push({
          id: `edge_${edgeIdCounter++}`,
          fromNode: to.id,
          toNode: from.id,
          points: reversePoints,
          lengthMeters,
          demand: null,
          freeFlowSpeed: DEFAULT_FREE_FLOW_SPEED,
          turningRatios: new Map(),
          bearing: reverseBearing,
        });
      }
    }
  }

  return edges;
}

function findNodeForEndpoint(
  point: Position,
  segId: string,
  which: 'start' | 'end',
  nodes: NodeCandidate[],
): NodeCandidate | undefined {
  // First try exact match by reference
  const byRef = nodes.find((n) =>
    n.mergedEndpoints.some((e) => e.segmentId === segId && e.which === which),
  );
  if (byRef) return byRef;

  // Fallback: closest node
  let best: NodeCandidate | undefined;
  let bestDist = Infinity;
  for (const node of nodes) {
    const d = distance(point, node.position);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

function findIntermediateNodes(
  seg: ReturnType<typeof parseElements>['segments'][0],
  nodes: NodeCandidate[],
  startNode: NodeCandidate,
  endNode: NodeCandidate,
): NodeCandidate[] {
  // Find nodes that are crossing-type on this segment
  return nodes
    .filter(
      (n) =>
        n.id !== startNode.id &&
        n.id !== endNode.id &&
        n.mergedEndpoints.some(
          (e) => e.segmentId === seg.id && e.which === 'crossing',
        ),
    )
    .sort((a, b) => {
      // Sort by distance along the segment from start
      const da = distance(seg.startPoint, a.position);
      const db = distance(seg.startPoint, b.position);
      return da - db;
    });
}

/**
 * Extract the sub-polyline between two positions along a polyline.
 * For simplicity, we create a straight line between the two node positions.
 * A more sophisticated version would trace along the original polyline.
 */
function extractSubPolyline(
  _fullPoints: Position[],
  from: Position,
  to: Position,
): Position[] {
  return [from, to];
}

function buildSignalPhases(
  node: NetworkNode,
  incomingEdges: NetworkEdge[],
): NetworkNode['phases'] {
  if (incomingEdges.length === 0) return [];

  const cycleTime = node.cycleTime ?? DEFAULT_CYCLE_TIME;

  // Cluster edges by opposite directions
  // Group edges whose bearings are within 30° of each other or opposite (±180°)
  const groups: NetworkEdge[][] = [];
  const assigned = new Set<string>();

  for (const edge of incomingEdges) {
    if (assigned.has(edge.id)) continue;

    const group = [edge];
    assigned.add(edge.id);

    for (const other of incomingEdges) {
      if (assigned.has(other.id)) continue;
      const diff = Math.abs(angleDifference(edge.bearing, other.bearing));
      // Opposite directions (within 30° of 180°)
      if (Math.abs(diff - 180) < 30 || diff < 30) {
        group.push(other);
        assigned.add(other.id);
      }
    }

    groups.push(group);
  }

  // Even green split
  const greenPerPhase = cycleTime / groups.length;

  return groups.map((group, i) => ({
    id: `phase_${node.id}_${i}`,
    edgeIds: group.map((e) => e.id),
    greenDuration: greenPerPhase,
  }));
}

function emptyGraph(scale: number): NetworkGraph {
  return {
    nodes: [],
    edges: [],
    scale,
    metadata: {
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      elementCount: 0,
      warnings: [],
    },
  };
}
