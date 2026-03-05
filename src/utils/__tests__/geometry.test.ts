import { describe, it, expect } from 'vitest';
import {
  distance,
  lineIntersection,
  bearing,
  angleDifference,
  polylineLength,
  positionAlongPolyline,
  pointToSegmentDistance,
  nearestPointOnSegment,
  quadraticBezier,
} from '../geometry';

describe('distance', () => {
  it('computes Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('lineIntersection', () => {
  it('finds crossing point of two segments', () => {
    const result = lineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(5);
    expect(result!.y).toBeCloseTo(5);
  });

  it('returns null for parallel segments', () => {
    const result = lineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    );
    expect(result).toBeNull();
  });

  it('returns null for non-overlapping segments', () => {
    const result = lineIntersection(
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: -5 },
      { x: 6, y: 5 },
    );
    expect(result).toBeNull();
  });

  it('finds intersection at segment endpoints', () => {
    const result = lineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(10);
    expect(result!.y).toBeCloseTo(0);
  });
});

describe('bearing', () => {
  it('east is 90°', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
  });

  it('north (up in screen = negative Y) is 0°', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0);
  });

  it('south (down in screen) is 180°', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180);
  });

  it('west is 270°', () => {
    expect(bearing({ x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(270);
  });
});

describe('angleDifference', () => {
  it('350° to 10° is +20°', () => {
    expect(angleDifference(350, 10)).toBeCloseTo(20);
  });

  it('10° to 350° is −20°', () => {
    expect(angleDifference(10, 350)).toBeCloseTo(-20);
  });

  it('0° to 180° is 180°', () => {
    expect(angleDifference(0, 180)).toBeCloseTo(180);
  });

  it('same bearing gives 0', () => {
    expect(angleDifference(45, 45)).toBeCloseTo(0);
  });
});

describe('polylineLength', () => {
  it('computes length of L-shaped polyline', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe(20);
  });

  it('single segment', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(5);
  });
});

describe('positionAlongPolyline', () => {
  it('returns midpoint of single segment', () => {
    const result = positionAlongPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      5,
    );
    expect(result.position.x).toBeCloseTo(5);
    expect(result.position.y).toBeCloseTo(0);
    expect(result.bearing).toBeCloseTo(90); // east
  });

  it('returns start point at dist=0', () => {
    const result = positionAlongPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      0,
    );
    expect(result.position.x).toBeCloseTo(0);
    expect(result.position.y).toBeCloseTo(0);
  });

  it('handles multi-segment polyline', () => {
    const result = positionAlongPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      15,
    );
    expect(result.position.x).toBeCloseTo(10);
    expect(result.position.y).toBeCloseTo(5);
    expect(result.bearing).toBeCloseTo(180); // south
  });
});

describe('pointToSegmentDistance', () => {
  it('perpendicular distance', () => {
    expect(
      pointToSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBeCloseTo(5);
  });

  it('distance to endpoint when projection is outside', () => {
    expect(
      pointToSegmentDistance(
        { x: -5, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ),
    ).toBeCloseTo(5);
  });
});

describe('nearestPointOnSegment', () => {
  it('projects to midpoint', () => {
    const result = nearestPointOnSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    );
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(0);
  });

  it('clamps to start', () => {
    const result = nearestPointOnSegment(
      { x: -5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    );
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });
});

describe('quadraticBezier', () => {
  it('returns p0 at t=0', () => {
    const result = quadraticBezier(
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
      0,
    );
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('returns p2 at t=1', () => {
    const result = quadraticBezier(
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
      1,
    );
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(0);
  });

  it('returns midpoint at t=0.5', () => {
    const result = quadraticBezier(
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
      0.5,
    );
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(5);
  });
});
