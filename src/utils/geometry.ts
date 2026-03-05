import type { Position } from '@/types/network';

/** Euclidean distance between two points */
export function distance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Intersection point of segments p1–p2 and p3–p4.
 * Returns null if parallel or non-intersecting.
 */
export function lineIntersection(
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position,
): Position | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null; // outside segments

  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y,
  };
}

/** Perpendicular distance from point to line segment */
export function pointToSegmentDistance(
  point: Position,
  segStart: Position,
  segEnd: Position,
): number {
  const nearest = nearestPointOnSegment(point, segStart, segEnd);
  return distance(point, nearest);
}

/**
 * Compass bearing in degrees (0 = north/up, 90 = east/right).
 * Screen coords: Y increases downward, so north = negative Y direction.
 */
export function bearing(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // atan2(dx, -dy): north is -Y in screen coords
  const rad = Math.atan2(dx, -dy);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/** Signed angle difference in degrees (−180 to +180) */
export function angleDifference(bearing1: number, bearing2: number): number {
  let diff = bearing2 - bearing1;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/** Closest point on segment to given point */
export function nearestPointOnSegment(
  point: Position,
  segStart: Position,
  segEnd: Position,
): Position {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return segStart;

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };
}

/** Total length of a polyline */
export function polylineLength(points: Position[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

/** Point and bearing at distance along polyline */
export function positionAlongPolyline(
  points: Position[],
  dist: number,
): { position: Position; bearing: number } {
  if (points.length < 2) {
    return { position: points[0], bearing: 0 };
  }

  let remaining = dist;
  for (let i = 1; i < points.length; i++) {
    const segLen = distance(points[i - 1], points[i]);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen > 0 ? Math.min(remaining / segLen, 1) : 0;
      return {
        position: {
          x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
          y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
        },
        bearing: bearing(points[i - 1], points[i]),
      };
    }
    remaining -= segLen;
  }

  // Past end — return last point
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { position: last, bearing: bearing(prev, last) };
}

/** Point at parameter t on quadratic Bezier (p0, p1=control, p2) */
export function quadraticBezier(
  p0: Position,
  p1: Position,
  p2: Position,
  t: number,
): Position {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}
