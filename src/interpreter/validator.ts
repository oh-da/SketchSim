import type { NetworkGraph, InterpreterWarning } from '@/types/network';

/**
 * Validate the network graph and produce warnings (not errors).
 * Warnings are shown in the preview overlay; they never block simulation.
 */
export function validateGraph(graph: NetworkGraph): InterpreterWarning[] {
  const warnings: InterpreterWarning[] = [];

  // Check for disconnected components
  if (graph.nodes.length > 1) {
    const components = findConnectedComponents(graph);
    if (components > 1) {
      warnings.push({
        type: 'disconnected',
        message: `Network has ${components} disconnected components. Each will simulate independently.`,
        position: graph.nodes[0].position,
        elementIds: [],
      });
    }
  }

  // Check for edges with no demand
  const hasAnyDemand = graph.edges.some((e) => e.demand !== null && e.demand > 0);
  if (!hasAnyDemand && graph.edges.length > 0) {
    warnings.push({
      type: 'no_demand',
      message: 'No demand values found. Using default 100 veh/hr on all edges.',
      position: graph.nodes[0]?.position ?? { x: 0, y: 0 },
      elementIds: [],
    });
  }

  return warnings;
}

function findConnectedComponents(graph: NetworkGraph): number {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const adj = new Map<string, Set<string>>();

  for (const id of nodeIds) {
    adj.set(id, new Set());
  }
  for (const edge of graph.edges) {
    adj.get(edge.fromNode)?.add(edge.toNode);
    adj.get(edge.toNode)?.add(edge.fromNode);
  }

  const visited = new Set<string>();
  let components = 0;

  for (const id of nodeIds) {
    if (visited.has(id)) continue;
    components++;
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
  }

  return components;
}
