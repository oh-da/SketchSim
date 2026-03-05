import type { EdgeMetrics } from '@/types/metrics';
import type { NetworkGraph } from '@/types/network';
import { QUEUE_BADGE_MIN } from '@/utils/constants';
import { COLORS } from '@/utils/colors';

/**
 * Render metrics overlay: queue badges and speed-gradient edge coloring.
 */
export function renderMetrics(
  ctx: CanvasRenderingContext2D,
  graph: NetworkGraph,
  edgeMetrics: Map<string, EdgeMetrics>,
): void {
  for (const edge of graph.edges) {
    const metrics = edgeMetrics.get(edge.id);
    if (!metrics) continue;

    // Speed gradient on edge (draw under badges)
    if (metrics.avgSpeed > 0 || metrics.queueLength > 0) {
      drawSpeedOverlay(ctx, edge.points, metrics.avgSpeed, edge.freeFlowSpeed);
    }

    // Queue badge at edge end
    if (metrics.queueLength >= QUEUE_BADGE_MIN) {
      const endPoint = edge.points[edge.points.length - 1];
      drawQueueBadge(ctx, endPoint.x, endPoint.y - 20, metrics.queueLength);
    }
  }
}

function drawQueueBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.85;

  // Red circle
  ctx.fillStyle = COLORS.stopped;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();

  // Count text
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), x, y);

  ctx.restore();
}

function drawSpeedOverlay(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  avgSpeed: number,
  freeFlowSpeed: number,
): void {
  if (points.length < 2) return;

  // 0 = red (stopped), 1 = green (free flow)
  const ratio = Math.min(avgSpeed / freeFlowSpeed, 1);
  const r = Math.round(255 * (1 - ratio));
  const g = Math.round(200 * ratio);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = `rgb(${r}, ${g}, 0)`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.restore();
}
