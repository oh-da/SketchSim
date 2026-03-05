import { describe, it, expect } from 'vitest';
import { snapEndpoints } from '../snapEngine';
import type { RawSegment } from '../parser';

function seg(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RawSegment {
  return {
    id,
    startPoint: { x: x1, y: y1 },
    endPoint: { x: x2, y: y2 },
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    isArrow: false,
  };
}

describe('snapEndpoints', () => {
  it('auto-merges endpoints within 10px', () => {
    const segments = [
      seg('a', 0, 0, 100, 0),
      seg('b', 108, 0, 200, 0), // 8px from 'a' end
    ];
    const result = snapEndpoints(segments);

    // The two close endpoints should merge into one node
    const mergedNode = result.nodes.find(
      (n) => n.mergedEndpoints.length >= 2,
    );
    expect(mergedNode).toBeDefined();
    expect(result.suggestions).toHaveLength(0);
  });

  it('generates suggestion for 10-20px gap (no merge)', () => {
    const segments = [
      seg('a', 0, 0, 100, 0),
      seg('b', 115, 0, 200, 0), // 15px from 'a' end
    ];
    const result = snapEndpoints(segments);

    // Should NOT be merged
    const aEnd = result.nodes.find((n) =>
      n.mergedEndpoints.some((e) => e.segmentId === 'a' && e.which === 'end'),
    );
    const bStart = result.nodes.find((n) =>
      n.mergedEndpoints.some((e) => e.segmentId === 'b' && e.which === 'start'),
    );
    expect(aEnd!.id).not.toBe(bStart!.id);

    // Should have a snap suggestion
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('no merge or suggestion for >20px gap', () => {
    const segments = [
      seg('a', 0, 0, 100, 0),
      seg('b', 125, 0, 200, 0), // 25px from 'a' end
    ];
    const result = snapEndpoints(segments);

    const aEnd = result.nodes.find((n) =>
      n.mergedEndpoints.some((e) => e.segmentId === 'a' && e.which === 'end'),
    );
    const bStart = result.nodes.find((n) =>
      n.mergedEndpoints.some((e) => e.segmentId === 'b' && e.which === 'start'),
    );
    expect(aEnd!.id).not.toBe(bStart!.id);
    expect(result.suggestions).toHaveLength(0);
  });

  it('detects crossing lines as intersection', () => {
    const segments = [
      seg('h', 0, 50, 100, 50),   // horizontal
      seg('v', 50, 0, 50, 100),   // vertical, crosses at (50,50)
    ];
    const result = snapEndpoints(segments);

    const intersectionNode = result.nodes.find(
      (n) => n.type === 'intersection',
    );
    expect(intersectionNode).toBeDefined();
    expect(intersectionNode!.position.x).toBeCloseTo(50, 0);
    expect(intersectionNode!.position.y).toBeCloseTo(50, 0);
  });

  it('handles T-intersection (endpoint near segment midpoint)', () => {
    const segments = [
      seg('h', 0, 50, 100, 50),    // horizontal
      seg('v', 50, 50, 50, 100),   // starts at midpoint of h (T-intersection)
    ];
    const result = snapEndpoints(segments);

    // The start of 'v' should merge with a point on 'h' near (50,50)
    const merged = result.nodes.find(
      (n) =>
        n.mergedEndpoints.some((e) => e.segmentId === 'v') &&
        n.mergedEndpoints.some((e) => e.segmentId === 'h'),
    );
    expect(merged).toBeDefined();
  });
});
