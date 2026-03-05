import type { NetworkGraph } from '@/types/network';
import type { SnapSuggestion } from '@/interpreter/snapEngine';
import type { UnassociatedText } from '@/interpreter/textAssociator';
import { COLORS } from '@/utils/colors';

/**
 * Render the interpreted network as a translucent overlay.
 * Shows nodes, edges, demand badges, signal icons, snap suggestions, and warnings.
 */
export function renderPreview(
  ctx: CanvasRenderingContext2D,
  graph: NetworkGraph,
  suggestions: SnapSuggestion[],
  unassociatedTexts: UnassociatedText[],
): void {
  // Draw edges as thin directional arrows
  for (const edge of graph.edges) {
    drawEdgeArrow(ctx, edge.points);
  }

  // Draw nodes
  for (const node of graph.nodes) {
    if (node.type === 'intersection') {
      drawNode(ctx, node.position.x, node.position.y, 8, COLORS.primary, 0.5);
    } else {
      drawNode(ctx, node.position.x, node.position.y, 6, COLORS.muted, 0.4);
    }

    // Signal icon
    if (node.signalized) {
      drawSignalIcon(ctx, node.position.x, node.position.y);
    }
  }

  // Draw demand badges
  for (const edge of graph.edges) {
    if (edge.demand !== null && edge.demand > 0) {
      const pos = edge.points[0]; // fromNode end
      drawDemandBadge(ctx, pos.x, pos.y - 16, edge.demand);
    }
  }

  // Draw snap suggestions (ghost dotted lines)
  for (const suggestion of suggestions) {
    drawSnapSuggestion(ctx, suggestion);
  }

  // Draw warnings for ambiguous text
  for (const text of unassociatedTexts) {
    if (text.reason === 'ambiguous') {
      drawWarningCircle(ctx, text.center.x, text.center.y);
    }
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Arrowhead at the end
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const headLen = 8;

  ctx.fillStyle = COLORS.primary;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(
    last.x - headLen * Math.cos(angle - Math.PI / 6),
    last.y - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    last.x - headLen * Math.cos(angle + Math.PI / 6),
    last.y - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDemandBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  demand: number,
): void {
  const text = `${demand} veh/h`;
  ctx.save();
  ctx.font = '11px Inter, system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 6;
  const padY = 3;
  const w = metrics.width + padX * 2;
  const h = 16 + padY * 2;

  // Pill background
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);

  ctx.restore();
}

function drawSignalIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.7;

  // Simple traffic light: small rectangle with green/red dots
  const w = 10;
  const h = 18;
  ctx.fillStyle = '#333';
  ctx.fillRect(x - w / 2 + 14, y - h / 2, w, h);

  // Red dot
  ctx.fillStyle = COLORS.stopped;
  ctx.beginPath();
  ctx.arc(x + 14, y - 4, 3, 0, Math.PI * 2);
  ctx.fill();

  // Green dot
  ctx.fillStyle = COLORS.moving;
  ctx.beginPath();
  ctx.arc(x + 14, y + 4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSnapSuggestion(
  ctx: CanvasRenderingContext2D,
  suggestion: SnapSuggestion,
): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = COLORS.yielding;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(suggestion.point1.x, suggestion.point1.y);
  ctx.lineTo(suggestion.point2.x, suggestion.point2.y);
  ctx.stroke();

  ctx.restore();
}

function drawWarningCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#FF8C00'; // orange
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
