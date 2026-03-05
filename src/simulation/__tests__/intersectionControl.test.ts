import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalController,
  canEnterIntersection,
  selectExitEdge,
} from '../intersectionControl';
import type { NetworkNode, NetworkEdge } from '@/types/network';
import type { Agent } from '@/types/agent';

// ─── Helpers ────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    currentEdge: 'e1',
    positionOnEdge: 100,
    speed: 10,
    acceleration: 0,
    state: 'moving',
    desiredSpeed: 13.9,
    waitTime: 0,
    spawnTime: 0,
    nextEdge: null,
    turningProgress: null,
    ...overrides,
  };
}

function makeEdge(id: string, from: string, to: string, overrides: Partial<NetworkEdge> = {}): NetworkEdge {
  return {
    id,
    fromNode: from,
    toNode: to,
    points: [],
    lengthMeters: 200,
    demand: null,
    freeFlowSpeed: 13.9,
    turningRatios: new Map(),
    bearing: 0,
    ...overrides,
  };
}

function makeNode(id: string, overrides: Partial<NetworkNode> = {}): NetworkNode {
  return {
    id,
    position: { x: 0, y: 0 },
    type: 'intersection',
    signalized: false,
    cycleTime: null,
    phases: [],
    priorityEdges: [],
    connectedEdges: [],
    ...overrides,
  };
}

// ─── Signal Controller ──────────────────────────────────────────────

describe('SignalController', () => {
  let controller: SignalController;

  beforeEach(() => {
    controller = new SignalController();
  });

  it('initializes and cycles through phases', () => {
    const node = makeNode('n1', {
      signalized: true,
      cycleTime: 60,
      phases: [
        { id: 'p0', edgeIds: ['e_ns', 'e_sn'], greenDuration: 30 },
        { id: 'p1', edgeIds: ['e_ew', 'e_we'], greenDuration: 30 },
      ],
    });

    controller.init([node]);

    // Phase 0 is green initially
    expect(controller.isGreen('n1', 'e_ns')).toBe(true);
    expect(controller.isGreen('n1', 'e_ew')).toBe(false);

    // Advance 31 seconds → Phase 1
    controller.tick(31);
    expect(controller.isGreen('n1', 'e_ns')).toBe(false);
    expect(controller.isGreen('n1', 'e_ew')).toBe(true);

    // Advance 30 more seconds → back to Phase 0
    controller.tick(30);
    expect(controller.isGreen('n1', 'e_ns')).toBe(true);
    expect(controller.isGreen('n1', 'e_ew')).toBe(false);
  });

  it('vehicles waiting at red start moving when green begins', () => {
    const node = makeNode('n1', {
      signalized: true,
      cycleTime: 20,
      phases: [
        { id: 'p0', edgeIds: ['e1'], greenDuration: 10 },
        { id: 'p1', edgeIds: ['e2'], greenDuration: 10 },
      ],
    });

    controller.init([node]);

    // e2 is red at start
    expect(controller.isGreen('n1', 'e2')).toBe(false);

    // Tick to phase 1
    controller.tick(11);
    expect(controller.isGreen('n1', 'e2')).toBe(true);
  });

  it('returns true for unknown node (no signal = always green)', () => {
    expect(controller.isGreen('nonexistent', 'e1')).toBe(true);
  });
});

// ─── Gap Acceptance ─────────────────────────────────────────────────

describe('canEnterIntersection', () => {
  it('priority vehicle always proceeds', () => {
    const agent = makeAgent();
    const edge = makeEdge('e1', 'n0', 'n1');
    const node = makeNode('n1', { priorityEdges: ['e1', 'e2'] });

    const result = canEnterIntersection(
      agent, edge, node,
      () => [],
      () => undefined,
    );
    expect(result.canEnter).toBe(true);
    expect(result.reason).toBe('priority');
  });

  it('minor road waits for approaching priority vehicle', () => {
    const agent = makeAgent({ currentEdge: 'e_minor' });
    const minorEdge = makeEdge('e_minor', 'n0', 'n1');
    const priorityEdge = makeEdge('e_priority', 'n2', 'n1', { lengthMeters: 200 });
    const node = makeNode('n1', { priorityEdges: ['e_priority'] });

    // Approaching priority vehicle: 50m away at 10 m/s = 5s (> criticalGap? no, 2.5)
    // Wait, 50m / 10m/s = 5s > 2.5s, so should be OK
    // Let's make it closer: 20m away at 10 m/s = 2s < 2.5s
    const priorityAgent = makeAgent({
      id: 'p1',
      currentEdge: 'e_priority',
      positionOnEdge: 180, // 200 - 180 = 20m to node
      speed: 10,
    });

    const result = canEnterIntersection(
      agent, minorEdge, node,
      (eid) => eid === 'e_priority' ? [priorityAgent] : [],
      (eid) => eid === 'e_priority' ? priorityEdge : undefined,
    );
    expect(result.canEnter).toBe(false);
    expect(result.reason).toBe('gap_blocked');
  });

  it('minor road proceeds when gap is large enough', () => {
    const agent = makeAgent({ currentEdge: 'e_minor' });
    const minorEdge = makeEdge('e_minor', 'n0', 'n1');
    const priorityEdge = makeEdge('e_priority', 'n2', 'n1', { lengthMeters: 200 });
    const node = makeNode('n1', { priorityEdges: ['e_priority'] });

    // Priority vehicle far away: 100m at 10 m/s = 10s > 2.5s
    const priorityAgent = makeAgent({
      id: 'p1',
      currentEdge: 'e_priority',
      positionOnEdge: 100,
      speed: 10,
    });

    const result = canEnterIntersection(
      agent, minorEdge, node,
      (eid) => eid === 'e_priority' ? [priorityAgent] : [],
      (eid) => eid === 'e_priority' ? priorityEdge : undefined,
    );
    expect(result.canEnter).toBe(true);
    expect(result.reason).toBe('gap_ok');
  });

  it('deadlock breaker: forces entry after 8s', () => {
    const agent = makeAgent({ currentEdge: 'e_minor', waitTime: 8.5 });
    const minorEdge = makeEdge('e_minor', 'n0', 'n1');
    const node = makeNode('n1', { priorityEdges: ['e_priority'] });

    const result = canEnterIntersection(
      agent, minorEdge, node,
      () => [],
      () => undefined,
    );
    expect(result.canEnter).toBe(true);
    expect(result.reason).toBe('deadlock_forced');
    expect(agent.waitTime).toBe(0); // Reset
  });

  it('no priority edges = free to enter', () => {
    const agent = makeAgent();
    const edge = makeEdge('e1', 'n0', 'n1');
    const node = makeNode('n1', { priorityEdges: [] });

    const result = canEnterIntersection(
      agent, edge, node,
      () => [],
      () => undefined,
    );
    expect(result.canEnter).toBe(true);
    expect(result.reason).toBe('no_priority');
  });
});

// ─── Exit Edge Selection ────────────────────────────────────────────

describe('selectExitEdge', () => {
  it('returns null at dead end', () => {
    const edge = makeEdge('e1', 'n0', 'n1');
    const node = makeNode('n1');
    // No outgoing edges from n1
    const result = selectExitEdge(edge, node, [edge]);
    expect(result).toBeNull();
  });

  it('returns the only outgoing edge', () => {
    const edge = makeEdge('e1', 'n0', 'n1');
    const outEdge = makeEdge('e2', 'n1', 'n2');
    const node = makeNode('n1');

    const result = selectExitEdge(edge, node, [edge, outEdge]);
    expect(result).toBe(outEdge);
  });

  it('distributes according to turning ratios over many selections', () => {
    const edge = makeEdge('e_in', 'n0', 'n1', {
      turningRatios: new Map([
        ['e_straight', 0.6],
        ['e_right', 0.25],
        ['e_left', 0.15],
      ]),
    });
    const straight = makeEdge('e_straight', 'n1', 'n2');
    const right = makeEdge('e_right', 'n1', 'n3');
    const left = makeEdge('e_left', 'n1', 'n4');
    const node = makeNode('n1');
    const allEdges = [edge, straight, right, left];

    const counts: Record<string, number> = { e_straight: 0, e_right: 0, e_left: 0 };
    const N = 10000;

    for (let i = 0; i < N; i++) {
      const selected = selectExitEdge(edge, node, allEdges);
      if (selected) counts[selected.id]++;
    }

    // Check distribution within ±5%
    expect(counts.e_straight / N).toBeCloseTo(0.6, 1);
    expect(counts.e_right / N).toBeCloseTo(0.25, 1);
    expect(counts.e_left / N).toBeCloseTo(0.15, 1);
  });
});
