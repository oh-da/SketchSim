import { create } from 'zustand';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { NetworkGraph } from '@/types/network';

interface NetworkState {
  elements: ExcalidrawElement[];
  graph: NetworkGraph | null;
  setElements: (els: ExcalidrawElement[]) => void;
  setGraph: (g: NetworkGraph) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  elements: [],
  graph: null,
  setElements: (elements) => set({ elements }),
  setGraph: (graph) => set({ graph }),
}));
