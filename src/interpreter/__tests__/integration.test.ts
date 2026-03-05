import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graphBuilder';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Helper to create mock Excalidraw elements for testing.
 * Excalidraw stores line points as relative offsets from (x, y).
 */
function mockLine(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: 'line' | 'arrow' = 'line',
): ExcalidrawElement {
  return {
    id,
    type,
    x: x1,
    y: y1,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    isDeleted: false,
  } as unknown as ExcalidrawElement;
}

function mockText(
  id: string,
  x: number,
  y: number,
  text: string,
): ExcalidrawElement {
  return {
    id,
    type: 'text',
    x,
    y,
    width: 40,
    height: 20,
    text,
    isDeleted: false,
  } as unknown as ExcalidrawElement;
}

function mockEllipse(
  id: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): ExcalidrawElement {
  return {
    id,
    type: 'ellipse',
    x: cx - rx,
    y: cy - ry,
    width: rx * 2,
    height: ry * 2,
    isDeleted: false,
  } as unknown as ExcalidrawElement;
}

describe('buildGraph integration', () => {
  it('builds 4-way intersection from two crossing lines', () => {
    const elements = [
      mockLine('h', 0, 100, 200, 100),    // horizontal
      mockLine('v', 100, 0, 100, 200),     // vertical
    ];

    const { graph } = buildGraph(elements);

    // Should have intersection node(s)
    const intersections = graph.nodes.filter((n) => n.type === 'intersection');
    expect(intersections.length).toBeGreaterThanOrEqual(1);

    // Should have edges (plain lines create 2 directions each, split at intersection)
    expect(graph.edges.length).toBeGreaterThanOrEqual(4);

    // All edges should have valid length
    for (const edge of graph.edges) {
      expect(edge.lengthMeters).toBeGreaterThan(0);
    }
  });

  it('associates demand text to nearest edge', () => {
    const elements = [
      mockLine('road', 0, 100, 200, 100),
      mockText('demand', -5, 80, '200'), // near start of road
    ];

    const { graph } = buildGraph(elements);

    // At least one edge should have demand = 200
    const withDemand = graph.edges.filter((e) => e.demand === 200);
    expect(withDemand.length).toBeGreaterThanOrEqual(1);
  });

  it('detects signalized intersection', () => {
    const elements = [
      mockLine('h', 0, 100, 200, 100),
      mockLine('v', 100, 0, 100, 200),
      mockEllipse('signal', 100, 100, 15, 15), // circle at intersection
    ];

    const { graph } = buildGraph(elements);

    const signalized = graph.nodes.filter((n) => n.signalized);
    expect(signalized.length).toBeGreaterThanOrEqual(1);
    expect(signalized[0].cycleTime).toBe(60); // default
  });

  it('marks unassociated text when too far', () => {
    const elements = [
      mockLine('road', 0, 100, 200, 100),
      mockText('far', 300, 300, '500'), // 200+ px away
    ];

    const { unassociatedTexts } = buildGraph(elements);
    const tooFar = unassociatedTexts.filter((t) => t.reason === 'too_far');
    expect(tooFar.length).toBeGreaterThanOrEqual(1);
  });

  it('generates snap suggestion for near-miss endpoints', () => {
    const elements = [
      mockLine('a', 0, 0, 100, 0),
      mockLine('b', 115, 0, 200, 0), // 15px gap
    ];

    const { suggestions } = buildGraph(elements);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty graph for no elements', () => {
    const { graph } = buildGraph([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('handles arrow (one-way) segments', () => {
    const elements = [
      mockLine('arrow', 0, 100, 200, 100, 'arrow'),
    ];

    const { graph } = buildGraph(elements);

    // Arrow should produce only 1 directed edge (not 2)
    // A single segment with 2 endpoints = 1 edge
    const forwardEdges = graph.edges.filter(
      (e) => e.points[0].x < e.points[e.points.length - 1].x,
    );
    const reverseEdges = graph.edges.filter(
      (e) => e.points[0].x > e.points[e.points.length - 1].x,
    );
    expect(forwardEdges.length).toBe(1);
    expect(reverseEdges.length).toBe(0);
  });

  it('assigns default demand when no text is present', () => {
    const elements = [
      mockLine('road', 0, 100, 200, 100),
    ];

    const { graph } = buildGraph(elements);

    // Should default to 100 veh/hr on endpoint edges
    const withDemand = graph.edges.filter((e) => e.demand !== null && e.demand > 0);
    expect(withDemand.length).toBeGreaterThanOrEqual(1);
    expect(withDemand[0].demand).toBe(100);
  });

  it('computes turning ratios at intersections', () => {
    const elements = [
      mockLine('h', 0, 100, 200, 100),
      mockLine('v', 100, 0, 100, 200),
    ];

    const { graph } = buildGraph(elements);

    // Edges entering the intersection should have turning ratios
    const edgesWithRatios = graph.edges.filter(
      (e) => e.turningRatios.size > 0,
    );
    expect(edgesWithRatios.length).toBeGreaterThanOrEqual(1);

    // Each set of ratios should sum to ~1.0
    for (const edge of edgesWithRatios) {
      const sum = Array.from(edge.turningRatios.values()).reduce(
        (s, v) => s + v,
        0,
      );
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it('pipeline completes quickly', () => {
    // 20 elements
    const elements: ExcalidrawElement[] = [];
    for (let i = 0; i < 10; i++) {
      elements.push(mockLine(`h${i}`, 0, i * 50, 400, i * 50));
      elements.push(mockLine(`v${i}`, i * 50, 0, i * 50, 400));
    }

    const start = performance.now();
    buildGraph(elements);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500); // should be well under 50ms
  });
});
