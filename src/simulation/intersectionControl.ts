import type { NetworkNode, NetworkEdge, SignalPhase } from '@/types/network';
import type { Agent } from '@/types/agent';
import { CRITICAL_GAP, MAX_WAIT_TIME } from '@/utils/constants';

// ─── Signal Controller ────────────────────────────────────────────────

interface SignalNodeState {
  nodeId: string;
  phases: SignalPhase[];
  cycleTime: number;
  currentPhaseIndex: number;
  timeInPhase: number;
}

/**
 * Manages signal phase cycling for all signalized nodes.
 * Each tick advances time-in-phase; when it exceeds green duration, switches to next phase.
 */
export class SignalController {
  private states: Map<string, SignalNodeState> = new Map();

  init(nodes: NetworkNode[]): void {
    for (const node of nodes) {
      if (!node.signalized || node.phases.length === 0) continue;

      const cycleTime = node.cycleTime ?? 60;
      this.states.set(node.id, {
        nodeId: node.id,
        phases: node.phases,
        cycleTime,
        currentPhaseIndex: 0,
        timeInPhase: 0,
      });
    }
  }

  tick(dt: number): void {
    for (const state of this.states.values()) {
      state.timeInPhase += dt;

      const currentPhase = state.phases[state.currentPhaseIndex];
      if (state.timeInPhase >= currentPhase.greenDuration) {
        // Advance to next phase
        state.timeInPhase -= currentPhase.greenDuration;
        state.currentPhaseIndex =
          (state.currentPhaseIndex + 1) % state.phases.length;
      }
    }
  }

  isGreen(nodeId: string, edgeId: string): boolean {
    const state = this.states.get(nodeId);
    if (!state) return true; // No signal state = always green

    const currentPhase = state.phases[state.currentPhaseIndex];
    return currentPhase.edgeIds.includes(edgeId);
  }

  /** Get phase index for rendering (0-based) */
  getCurrentPhaseIndex(nodeId: string): number {
    return this.states.get(nodeId)?.currentPhaseIndex ?? 0;
  }
}

// ─── Gap Acceptance (Unsignalized) ────────────────────────────────────

export interface GapAcceptanceResult {
  canEnter: boolean;
  reason: 'priority' | 'gap_ok' | 'gap_blocked' | 'deadlock_forced' | 'no_priority';
}

/**
 * Determines whether a minor-road vehicle can enter an unsignalized intersection.
 *
 * - Priority vehicles always proceed.
 * - Minor road checks CRITICAL_GAP (2.5s) against approaching priority vehicles.
 * - Deadlock breaker: after MAX_WAIT_TIME (8s), force entry.
 */
export function canEnterIntersection(
  agent: Agent,
  currentEdge: NetworkEdge,
  node: NetworkNode,
  getAgentsOnEdge: (edgeId: string) => Agent[],
  getEdge: (edgeId: string) => NetworkEdge | undefined,
): GapAcceptanceResult {
  // No priority edges = no conflict, free to enter
  if (node.priorityEdges.length === 0) {
    return { canEnter: true, reason: 'no_priority' };
  }

  // Agent on priority road always proceeds
  if (node.priorityEdges.includes(currentEdge.id)) {
    return { canEnter: true, reason: 'priority' };
  }

  // Deadlock breaker
  if (agent.waitTime >= MAX_WAIT_TIME) {
    agent.waitTime = 0;
    return { canEnter: true, reason: 'deadlock_forced' };
  }

  // Check gaps on all priority edges approaching this node
  for (const priorityEdgeId of node.priorityEdges) {
    const edge = getEdge(priorityEdgeId);
    if (!edge) continue;

    // Only check edges approaching this node (toNode == node.id)
    if (edge.toNode !== node.id) continue;

    const agents = getAgentsOnEdge(priorityEdgeId);
    for (const other of agents) {
      if (other.speed <= 0.1) continue; // Stopped vehicles don't block
      const distToNode = edge.lengthMeters - other.positionOnEdge;
      const timeToArrival = distToNode / other.speed;
      if (timeToArrival < CRITICAL_GAP) {
        return { canEnter: false, reason: 'gap_blocked' };
      }
    }
  }

  return { canEnter: true, reason: 'gap_ok' };
}

// ─── Exit Edge Selection ──────────────────────────────────────────────

/**
 * Select the exit edge for a vehicle at an intersection using turning ratios.
 * Returns null if the vehicle should exit the network (dead end).
 */
export function selectExitEdge(
  currentEdge: NetworkEdge,
  node: NetworkNode,
  allEdges: NetworkEdge[],
): NetworkEdge | null {
  // Get outgoing edges from this node, excluding the reverse of current
  const outgoing = allEdges.filter(
    (e) => e.fromNode === node.id && e.id !== currentEdge.id,
  );

  if (outgoing.length === 0) return null;
  if (outgoing.length === 1) return outgoing[0];

  // Weighted random from turning ratios
  const ratios = currentEdge.turningRatios;
  if (ratios.size === 0) {
    return outgoing[Math.floor(Math.random() * outgoing.length)];
  }

  const u = Math.random();
  let cumulative = 0;
  for (const edge of outgoing) {
    cumulative += ratios.get(edge.id) ?? 0;
    if (u < cumulative) return edge;
  }

  return outgoing[outgoing.length - 1];
}
