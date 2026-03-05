import { create } from 'zustand';
import type { Agent } from '@/types/agent';

interface SimulationState {
  status: 'idle' | 'running' | 'paused';
  clock: number;
  speed: number;
  agents: Agent[];
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  setAgents: (agents: Agent[]) => void;
  setClock: (clock: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  status: 'idle',
  clock: 0,
  speed: 1,
  agents: [],
  play: () => set({ status: 'running' }),
  pause: () => set({ status: 'paused' }),
  reset: () => set({ status: 'idle', clock: 0, agents: [] }),
  setSpeed: (speed) => set({ speed }),
  setAgents: (agents) => set({ agents }),
  setClock: (clock) => set({ clock }),
}));
