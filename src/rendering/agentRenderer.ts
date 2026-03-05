import type { Agent } from '@/types/agent';
import type { NetworkGraph } from '@/types/network';
import { positionAlongPolyline } from '@/utils/geometry';
import { getTurnPosition } from '@/rendering/bezierTurns';
import { COLORS } from '@/utils/colors';
import { LANE_OFFSET } from '@/utils/constants';
import { ScaleContext } from '@/utils/scale';

const scale = new ScaleContext();

/**
 * Render all agents as colored rounded rectangles on the overlay canvas.
 * Handles both on-edge agents and agents mid-turn (Bezier arc).
 */
export function renderAgents(
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  graph: NetworkGraph,
): void {
  const edgeMap = new Map(graph.edges.map((e) => [e.id, e]));
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const agent of agents) {
    const edge = edgeMap.get(agent.currentEdge);
    if (!edge) continue;

    let x: number;
    let y: number;
    let agentBearing: number;

    if (agent.turningProgress !== null && agent.nextEdge) {
      // Agent is mid-turn: render on Bezier arc
      const nextEdge = edgeMap.get(agent.nextEdge);
      const node = nodeMap.get(edge.toNode);
      if (!nextEdge || !node) continue;

      const edgeEnd = edge.points[edge.points.length - 1];
      const nextEdgeStart = nextEdge.points[0];
      const { position, bearing } = getTurnPosition(
        edgeEnd,
        node.position,
        nextEdgeStart,
        agent.turningProgress,
      );

      agentBearing = bearing;

      // Apply lane offset (right of travel direction)
      const bearingRad = ((bearing - 90) * Math.PI) / 180;
      x = position.x + Math.cos(bearingRad) * LANE_OFFSET;
      y = position.y - Math.sin(bearingRad) * LANE_OFFSET;
    } else {
      // Agent is on an edge: render along polyline
      const positionPx = scale.toPx(agent.positionOnEdge);
      const { position, bearing } = positionAlongPolyline(edge.points, positionPx);

      agentBearing = bearing;

      // Apply lane offset (right of travel direction)
      const bearingRad = ((bearing - 90) * Math.PI) / 180;
      x = position.x + Math.cos(bearingRad) * LANE_OFFSET;
      y = position.y - Math.sin(bearingRad) * LANE_OFFSET;
    }

    // Vehicle dimensions in pixels
    const vehLenPx = scale.vehicleLengthPx();
    const vehWidPx = vehLenPx * 0.55;

    // Color by state
    let color: string;
    let alpha = 1;
    switch (agent.state) {
      case 'moving':
        color = COLORS.moving;
        break;
      case 'yielding':
        color = COLORS.yielding;
        // Pulsing opacity
        alpha = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        break;
      case 'stopped':
        color = COLORS.stopped;
        break;
    }

    // Draw rotated rounded rectangle
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((agentBearing - 90) * Math.PI) / 180);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.roundRect(-vehLenPx / 2, -vehWidPx / 2, vehLenPx, vehWidPx, 2);
    ctx.fill();

    ctx.restore();
  }
}
