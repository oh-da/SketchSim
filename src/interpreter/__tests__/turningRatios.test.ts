import { describe, it, expect } from 'vitest';
import { computeTurningRatios } from '../turningRatios';
import type { NetworkEdge } from '@/types/network';

function makeEdge(id: string, bearingDeg: number): NetworkEdge {
  return {
    id,
    fromNode: 'n',
    toNode: 'n2',
    points: [],
    lengthMeters: 100,
    demand: null,
    freeFlowSpeed: 13.9,
    turningRatios: new Map(),
    bearing: bearingDeg,
  };
}

describe('computeTurningRatios', () => {
  it('4-way intersection: straight=60%, right=25%, left=15%', () => {
    // Incoming from south (bearing 0° = north), through direction = 180° (south)
    const incomingBearing = 0; // approaching from south heading north
    const outgoing = [
      makeEdge('straight', 0),   // continues north = straight
      makeEdge('right', 90),     // east = right turn
      makeEdge('left', 270),     // west = left turn
    ];

    const ratios = computeTurningRatios(incomingBearing, outgoing);

    expect(ratios.get('straight')).toBeCloseTo(0.60, 1);
    expect(ratios.get('right')).toBeCloseTo(0.25, 1);
    expect(ratios.get('left')).toBeCloseTo(0.15, 1);
  });

  it('T-intersection (no straight): redistributes', () => {
    // Incoming from south, T with only right and left
    const incomingBearing = 0;
    const outgoing = [
      makeEdge('right', 90),
      makeEdge('left', 270),
    ];

    const ratios = computeTurningRatios(incomingBearing, outgoing);

    const right = ratios.get('right')!;
    const left = ratios.get('left')!;

    // Should sum to 1
    expect(right + left).toBeCloseTo(1.0, 5);

    // Right should be larger than left (25% vs 15% base, redistributed)
    expect(right).toBeGreaterThan(left);
  });

  it('dead end (1 outgoing edge): 100%', () => {
    const ratios = computeTurningRatios(0, [makeEdge('only', 90)]);
    expect(ratios.get('only')).toBeCloseTo(1.0, 5);
  });

  it('all ratios sum to 1.0', () => {
    const incomingBearing = 45;
    const outgoing = [
      makeEdge('a', 0),
      makeEdge('b', 90),
      makeEdge('c', 180),
      makeEdge('d', 270),
    ];

    const ratios = computeTurningRatios(incomingBearing, outgoing);
    const sum = Array.from(ratios.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('U-turn gets 0%', () => {
    const incomingBearing = 0; // heading north, through = south (180°)
    const outgoing = [
      makeEdge('straight', 0),
      makeEdge('uturn', 180),    // back the way we came
    ];

    const ratios = computeTurningRatios(incomingBearing, outgoing);
    expect(ratios.get('uturn')).toBe(0);
    expect(ratios.get('straight')).toBeCloseTo(1.0, 5);
  });
});
