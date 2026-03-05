import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'warn' | 'error';
}

interface UIState {
  mode: 'drawing' | 'previewing' | 'simulating' | 'error';
  metricsVisible: boolean;
  toasts: Toast[];
  hasDrawn: boolean;
  setMode: (m: UIState['mode']) => void;
  toggleMetrics: () => void;
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
  setHasDrawn: (v: boolean) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  mode: 'drawing',
  metricsVisible: false,
  toasts: [],
  hasDrawn: false,
  setMode: (mode) => set({ mode }),
  toggleMetrics: () => set((s) => ({ metricsVisible: !s.metricsVisible })),
  addToast: (message, type) =>
    set((s) => ({
      toasts: [...s.toasts, { id: String(++toastCounter), message, type }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setHasDrawn: (hasDrawn) => set({ hasDrawn }),
}));
