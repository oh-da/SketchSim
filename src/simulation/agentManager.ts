import type { Agent } from '@/types/agent';
import { DEFAULT_FREE_FLOW_SPEED, SPEED_NOISE_RANGE } from '@/utils/constants';

let agentIdCounter = 0;

/**
 * Manages agent lifecycle with edge-level spatial indexing.
 * edgeIndex keeps sorted agent lists per edge for O(N) car-following.
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private pool: Agent[] = [];
  edgeIndex: Map<string, Agent[]> = new Map();

  spawn(edgeId: string, simTime: number, freeFlowSpeed: number = DEFAULT_FREE_FLOW_SPEED): Agent {
    const noise = 1 - SPEED_NOISE_RANGE + Math.random() * SPEED_NOISE_RANGE * 2;
    const desiredSpeed = freeFlowSpeed * noise;

    let agent: Agent;
    if (this.pool.length > 0) {
      agent = this.pool.pop()!;
      agent.id = `agent_${agentIdCounter++}`;
      agent.currentEdge = edgeId;
      agent.positionOnEdge = 0;
      agent.speed = 0;
      agent.acceleration = 0;
      agent.state = 'moving';
      agent.desiredSpeed = desiredSpeed;
      agent.waitTime = 0;
      agent.spawnTime = simTime;
      agent.nextEdge = null;
      agent.turningProgress = null;
    } else {
      agent = {
        id: `agent_${agentIdCounter++}`,
        currentEdge: edgeId,
        positionOnEdge: 0,
        speed: 0,
        acceleration: 0,
        state: 'moving',
        desiredSpeed,
        waitTime: 0,
        spawnTime: simTime,
        nextEdge: null,
        turningProgress: null,
      };
    }

    this.agents.set(agent.id, agent);
    this.addToEdgeIndex(edgeId, agent);
    return agent;
  }

  remove(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.removeFromEdgeIndex(agent.currentEdge, agentId);
    this.agents.delete(agentId);
    this.pool.push(agent); // recycle
  }

  /** Get agents on an edge, sorted by positionOnEdge (front-to-back = descending) */
  getAgentsOnEdge(edgeId: string): Agent[] {
    return this.edgeIndex.get(edgeId) ?? [];
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  get count(): number {
    return this.agents.size;
  }

  moveAgentToEdge(agent: Agent, newEdgeId: string): void {
    this.removeFromEdgeIndex(agent.currentEdge, agent.id);
    agent.currentEdge = newEdgeId;
    agent.positionOnEdge = 0;
    this.addToEdgeIndex(newEdgeId, agent);
  }

  /** Re-sort a single edge's agent list after position updates */
  sortEdge(edgeId: string): void {
    const list = this.edgeIndex.get(edgeId);
    if (list) {
      list.sort((a, b) => a.positionOnEdge - b.positionOnEdge);
    }
  }

  /** Check if the entry of an edge is clear (no vehicle within minGap) */
  isEntryClear(edgeId: string, minGap: number): boolean {
    const agents = this.edgeIndex.get(edgeId);
    if (!agents || agents.length === 0) return true;
    // First agent (lowest positionOnEdge) must be far enough from entry
    return agents[0].positionOnEdge >= minGap;
  }

  private addToEdgeIndex(edgeId: string, agent: Agent): void {
    let list = this.edgeIndex.get(edgeId);
    if (!list) {
      list = [];
      this.edgeIndex.set(edgeId, list);
    }
    list.push(agent);
    list.sort((a, b) => a.positionOnEdge - b.positionOnEdge);
  }

  private removeFromEdgeIndex(edgeId: string, agentId: string): void {
    const list = this.edgeIndex.get(edgeId);
    if (!list) return;
    const idx = list.findIndex((a) => a.id === agentId);
    if (idx >= 0) list.splice(idx, 1);
  }
}
