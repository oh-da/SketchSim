import { useRef, useCallback, useEffect } from 'react';
import ExcalidrawWrapper from '@/canvas/ExcalidrawWrapper';
import type { ViewportTransform } from '@/canvas/ExcalidrawWrapper';
import OverlayCanvas from '@/canvas/OverlayCanvas';
import Toolbar from '@/canvas/Toolbar';
import OnboardingOverlay from '@/ui/OnboardingOverlay';
import ToastContainer from '@/ui/Toast';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import { buildGraph, type BuildResult } from '@/interpreter/graphBuilder';
import { renderPreview } from '@/rendering/previewRenderer';
import { renderAgents } from '@/rendering/agentRenderer';
import { renderMetrics } from '@/rendering/metricsRenderer';
import { SimulationEngine } from '@/simulation/engine';
import type { EdgeMetrics } from '@/types/metrics';
import { INTERPRETER_DEBOUNCE } from '@/utils/constants';

export default function App() {
  const viewportRef = useRef<ViewportTransform>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });

  const hasDrawn = useUIStore((s) => s.hasDrawn);
  const setMode = useUIStore((s) => s.setMode);
  const metricsVisible = useUIStore((s) => s.metricsVisible);
  const addToast = useUIStore((s) => s.addToast);
  const simStatus = useSimulationStore((s) => s.status);
  const simSpeed = useSimulationStore((s) => s.speed);
  const setAgents = useSimulationStore((s) => s.setAgents);
  const setClock = useSimulationStore((s) => s.setClock);
  const elements = useNetworkStore((s) => s.elements);
  const setGraph = useNetworkStore((s) => s.setGraph);
  const graph = useNetworkStore((s) => s.graph);

  // Refs for simulation state (not in React state to avoid re-render per frame)
  const buildResultRef = useRef<BuildResult | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const latestAgentsRef = useRef<import('@/types/agent').Agent[]>([]);
  const latestMetricsRef = useRef<Map<string, EdgeMetrics> | null>(null);

  // Debounced interpreter: runs 200ms after last element change
  useEffect(() => {
    if (simStatus === 'running') return;

    const timer = setTimeout(() => {
      if (elements.length === 0) {
        setGraph(null!);
        buildResultRef.current = null;
        return;
      }
      const result = buildGraph(elements);
      buildResultRef.current = result;
      setGraph(result.graph);

      // Show interpreter warnings as toasts
      for (const w of result.graph.metadata.warnings) {
        addToast(w.message, 'warn');
      }
    }, INTERPRETER_DEBOUNCE);

    return () => clearTimeout(timer);
  }, [elements, simStatus, setGraph, addToast]);

  // Simulation loop: start/stop based on simStatus
  useEffect(() => {
    if (simStatus === 'running') {
      // Initialize engine if needed
      if (!engineRef.current && graph) {
        engineRef.current = new SimulationEngine(graph);
      }
      if (!engineRef.current) return;

      setMode('simulating');
      lastFrameRef.current = performance.now();

      const loop = (now: number) => {
        const engine = engineRef.current;
        if (!engine) return;

        const elapsed = (now - lastFrameRef.current) / 1000; // seconds
        lastFrameRef.current = now;

        // dt = elapsed real time * speed multiplier, capped to avoid spiral
        const dt = Math.min(elapsed * simSpeed, 0.1);
        const result = engine.tick(dt);

        latestAgentsRef.current = result.agents;
        latestMetricsRef.current = result.metrics.edges;
        setClock(result.clock);
        // Update agent count in store less frequently (every ~10 frames)
        if (Math.round(result.clock * 60) % 10 === 0) {
          setAgents([...result.agents]);
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafRef.current);
      };
    } else if (simStatus === 'idle') {
      // Reset
      engineRef.current = null;
      latestAgentsRef.current = [];
      latestMetricsRef.current = null;
      setMode(elements.length > 0 ? 'previewing' : 'drawing');
    } else if (simStatus === 'paused') {
      cancelAnimationFrame(rafRef.current);
    }
  }, [simStatus, graph, simSpeed, setMode, setClock, setAgents, elements.length]);

  // Render callback: draws preview OR simulation agents
  const handleRender = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (simStatus === 'running' || simStatus === 'paused') {
        const result = buildResultRef.current;
        // Render metrics overlay (under agents)
        if (metricsVisible && result && latestMetricsRef.current) {
          renderMetrics(ctx, result.graph, latestMetricsRef.current);
        }
        // Render agents
        if (result && latestAgentsRef.current.length > 0) {
          renderAgents(ctx, latestAgentsRef.current, result.graph);
        }
      } else {
        // Render preview
        const result = buildResultRef.current;
        if (!result) return;
        renderPreview(
          ctx,
          result.graph,
          result.suggestions,
          result.unassociatedTexts,
        );
      }
    },
    [simStatus, metricsVisible],
  );

  // Suppress Excalidraw's default space key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ExcalidrawWrapper viewportRef={viewportRef} />
      <OverlayCanvas viewportRef={viewportRef} onRender={handleRender} />
      <Toolbar />
      {!hasDrawn && <OnboardingOverlay />}
      <ToastContainer />
    </div>
  );
}
