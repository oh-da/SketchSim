import type { NetworkGraph, NetworkEdge, NetworkNode } from '@/types/network';
import type { Agent } from '@/types/agent';
import type { EdgeMetrics, GlobalMetrics } from '@/types/metrics';
import { AgentManager } from './agentManager';
import { PoissonSpawner } from './spawner';
import { computeAcceleration, DEFAULT_IDM_PARAMS } from './idm';
import {
  SignalController,
  canEnterIntersection,
  selectExitEdge,
} from './intersectionControl';
import { estimateTurnArcPx } from '@/rendering/bezierTurns';
import { MetricsCollector } from '@/metrics/collector';
import { pxToMeters } from '@/utils/scale';
import { VEHICLE_LENGTH, IDM_MIN_GAP } from '@/utils/constants';

export interface TickResult {
  agents: Agent[];
  clock: number;
  metrics: { edges: Map<string, EdgeMetrics>; global: GlobalMetrics };
}

/**
 * Main simulation engine. Discrete-time agent-based microsimulation.
 * Each tick: spawn → signals → move → turning → intersections → remove → metrics.
 */
export class SimulationEngine {
  private graph: NetworkGraph;
  private agentManager: AgentManager;
  private spawner: PoissonSpawner;
  private signals: SignalController;
  private metricsCollector: MetricsCollector;
  private clock = 0;
  private totalCompleted = 0;

  // Quick lookups
  private edgeMap: Map<string, NetworkEdge>;
  private nodeMap: Map<string, NetworkNode>;
  // Pre-computed dead-end edges
  private deadEndEdges: Set<string>;

  constructor(graph: NetworkGraph) {
    this.graph = graph;
    this.agentManager = new AgentManager();
    this.spawner = new PoissonSpawner(graph.edges);
    this.signals = new SignalController();
    this.metricsCollector = new MetricsCollector();

    this.edgeMap = new Map(graph.edges.map((e) => [e.id, e]));
    this.nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    this.signals.init(graph.nodes);

    // Pre-compute dead-end edges (edges ending at endpoint with no outgoing)
    this.deadEndEdges = new Set<string>();
    for (const node of graph.nodes) {
      if (node.type !== 'endpoint') continue;
      const outgoing = graph.edges.filter((e) => e.fromNode === node.id);
      if (outgoing.length > 0) continue;
      for (const edge of graph.edges.filter((e) => e.toNode === node.id)) {
        this.deadEndEdges.add(edge.id);
      }
    }
  }

  tick(dt: number): TickResult {
    this.clock += dt;
    this.spawnPhase();
    this.signals.tick(dt);
    this.movePhase(dt);
    this.turningPhase(dt);
    this.intersectionPhase(dt);
    this.removePhase();

    return {
      agents: this.agentManager.getAllAgents(),
      clock: this.clock,
      metrics: this.computeMetrics(),
    };
  }

  private spawnPhase(): void {
    const edgeIds = this.spawner.getSpawns(this.clock);
    for (const edgeId of edgeIds) {
      // Only spawn if entry is clear
      if (!this.agentManager.isEntryClear(edgeId, VEHICLE_LENGTH + IDM_MIN_GAP)) {
        continue;
      }
      const edge = this.edgeMap.get(edgeId);
      if (!edge) continue;
      this.agentManager.spawn(edgeId, this.clock, edge.freeFlowSpeed);
    }
  }

  private movePhase(dt: number): void {
    for (const edge of this.graph.edges) {
      const agents = this.agentManager.getAgentsOnEdge(edge.id);
      if (agents.length === 0) continue;

      // Iterate front-to-back (highest positionOnEdge first)
      for (let i = agents.length - 1; i >= 0; i--) {
        const agent = agents[i];

        // Skip agents in turning animation
        if (agent.turningProgress !== null) continue;

        // Find leader
        let gapToLeader: number | null = null;
        let leaderSpeed: number | null = null;

        if (i < agents.length - 1) {
          // Vehicle ahead on same edge
          const leader = agents[i + 1];
          gapToLeader =
            leader.positionOnEdge - agent.positionOnEdge - VEHICLE_LENGTH;
          leaderSpeed = leader.speed;
        } else {
          // Front vehicle: check if intersection ahead is blocked
          const toNode = this.nodeMap.get(edge.toNode);
          if (toNode && this.isFrontBlocked(edge, toNode, agent)) {
            // Virtual leader at stop line
            gapToLeader = edge.lengthMeters - agent.positionOnEdge;
            leaderSpeed = 0;
          }
        }

        // Compute IDM acceleration
        const params = {
          ...DEFAULT_IDM_PARAMS,
          desiredSpeed: agent.desiredSpeed,
        };
        agent.acceleration = computeAcceleration(
          params,
          agent.speed,
          gapToLeader,
          leaderSpeed,
        );

        // Update speed and position
        agent.speed = Math.max(0, agent.speed + agent.acceleration * dt);
        agent.positionOnEdge += agent.speed * dt;

        // Clamp to edge length
        if (agent.positionOnEdge >= edge.lengthMeters) {
          agent.positionOnEdge = edge.lengthMeters;
        }

        // Update visual state
        if (agent.speed < 0.5) {
          agent.state = 'stopped';
        } else {
          agent.state = 'moving';
        }
      }

      // Re-sort after position updates
      this.agentManager.sortEdge(edge.id);
    }
  }

  // ─── Turning animation ───────────────────────────────────────────

  private turningPhase(dt: number): void {
    for (const agent of this.agentManager.getAllAgents()) {
      if (agent.turningProgress === null || !agent.nextEdge) continue;

      const currentEdge = this.edgeMap.get(agent.currentEdge);
      const nextEdge = this.edgeMap.get(agent.nextEdge);
      if (!currentEdge || !nextEdge) {
        agent.turningProgress = null;
        agent.nextEdge = null;
        continue;
      }

      const node = this.nodeMap.get(currentEdge.toNode);
      if (!node) continue;

      // Compute arc length in meters from pixel coordinates
      const edgeEnd = currentEdge.points[currentEdge.points.length - 1];
      const nextEdgeStart = nextEdge.points[0];
      const arcPx = estimateTurnArcPx(edgeEnd, node.position, nextEdgeStart);
      const arcMeters = pxToMeters(arcPx);

      // Advance progress (minimum speed of 1 m/s so agents don't freeze mid-turn)
      const speed = Math.max(agent.speed, 1);
      agent.turningProgress += (speed * dt) / Math.max(arcMeters, 0.5);

      if (agent.turningProgress >= 1) {
        // Complete the turn
        const oldEdgeId = agent.currentEdge;
        const nextEdgeId = agent.nextEdge;
        agent.turningProgress = null;
        agent.nextEdge = null;
        this.agentManager.moveAgentToEdge(agent, nextEdgeId);
        this.metricsCollector.recordDeparture(oldEdgeId, this.clock);
      }
    }
  }

  // ─── Intersection processing ──────────────────────────────────────

  private intersectionPhase(dt: number): void {
    for (const edge of this.graph.edges) {
      const agents = this.agentManager.getAgentsOnEdge(edge.id);
      if (agents.length === 0) continue;

      const front = agents[agents.length - 1];

      // Skip agents already turning
      if (front.turningProgress !== null) continue;

      if (front.positionOnEdge < edge.lengthMeters - 0.1) continue;

      const toNode = this.nodeMap.get(edge.toNode);
      if (!toNode) continue;

      // Signalized: check signal phase
      if (toNode.signalized) {
        if (!this.signals.isGreen(toNode.id, edge.id)) {
          front.state = 'stopped';
          continue;
        }
      }

      // Unsignalized: gap acceptance
      if (!toNode.signalized && toNode.type === 'intersection') {
        const result = canEnterIntersection(
          front,
          edge,
          toNode,
          (eid) => this.agentManager.getAgentsOnEdge(eid),
          (eid) => this.edgeMap.get(eid),
        );

        if (!result.canEnter) {
          front.state = 'yielding';
          front.waitTime += dt;
          continue;
        }
      }

      // Select exit edge
      const exitEdge = selectExitEdge(edge, toNode, this.graph.edges);

      if (!exitEdge) {
        // Dead end: remove and record departure
        this.metricsCollector.recordDeparture(edge.id, this.clock);
        this.agentManager.remove(front.id);
        this.totalCompleted++;
      } else if (this.agentManager.isEntryClear(exitEdge.id, VEHICLE_LENGTH)) {
        // Initiate turn animation
        front.waitTime = 0;
        front.state = 'moving';
        front.nextEdge = exitEdge.id;
        front.turningProgress = 0;
      }
    }
  }

  // ─── Remove at dead ends ──────────────────────────────────────────

  private removePhase(): void {
    for (const edgeId of this.deadEndEdges) {
      const edge = this.edgeMap.get(edgeId)!;
      const agents = this.agentManager.getAgentsOnEdge(edgeId);
      for (let i = agents.length - 1; i >= 0; i--) {
        if (agents[i].positionOnEdge >= edge.lengthMeters - 0.1) {
          this.metricsCollector.recordDeparture(edgeId, this.clock);
          this.agentManager.remove(agents[i].id);
          this.totalCompleted++;
        }
      }
    }
  }

  /** Check if front vehicle should see a virtual leader (intersection blocked) */
  private isFrontBlocked(
    edge: NetworkEdge,
    node: NetworkNode,
    agent: Agent,
  ): boolean {
    if (node.type === 'endpoint') return false;

    if (node.signalized) {
      return !this.signals.isGreen(node.id, edge.id);
    }

    if (node.priorityEdges.length > 0) {
      const result = canEnterIntersection(
        agent,
        edge,
        node,
        (eid) => this.agentManager.getAgentsOnEdge(eid),
        (eid) => this.edgeMap.get(eid),
      );
      return !result.canEnter;
    }

    return false;
  }

  private computeMetrics(): { edges: Map<string, EdgeMetrics>; global: GlobalMetrics } {
    const edgeMetrics = new Map<string, EdgeMetrics>();
    let totalSpeed = 0;
    let totalAgents = 0;

    for (const edge of this.graph.edges) {
      const agents = this.agentManager.getAgentsOnEdge(edge.id);
      const metrics = this.metricsCollector.computeEdgeMetrics(
        edge.id,
        agents,
        this.clock,
      );
      edgeMetrics.set(edge.id, metrics);

      totalSpeed += agents.reduce((s, a) => s + a.speed, 0);
      totalAgents += agents.length;
    }

    return {
      edges: edgeMetrics,
      global: {
        totalVehicles: this.agentManager.count,
        totalCompleted: this.totalCompleted,
        avgNetworkSpeed: totalAgents > 0 ? totalSpeed / totalAgents : 0,
        simClock: this.clock,
      },
    };
  }
}
