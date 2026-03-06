import { useCallback, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import { loadFromUrl } from '@/utils/lzShare';

export interface ViewportTransform {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

interface ExcalidrawWrapperProps {
  viewportRef: React.MutableRefObject<ViewportTransform>;
}

export default function ExcalidrawWrapper({ viewportRef }: ExcalidrawWrapperProps) {
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const setElements = useNetworkStore((s) => s.setElements);
  const setHasDrawn = useUIStore((s) => s.setHasDrawn);
  const simStatus = useSimulationStore((s) => s.status);

  // Load initial elements from URL hash (once on mount)
  const [initialElements] = useState(() => {
    const loaded = loadFromUrl();
    return loaded as ExcalidrawElement[] | null;
  });

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      // Update viewport transform immediately (every frame)
      if (excalidrawAPIRef.current) {
        const appState = excalidrawAPIRef.current.getAppState();
        viewportRef.current = {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        };
      }

      // Update elements in store (interpreter debounce happens downstream)
      const els = elements as ExcalidrawElement[];
      setElements(els);

      if (els.length > 0) {
        setHasDrawn(true);
      }
    },
    [setElements, setHasDrawn, viewportRef],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api;
        }}
        initialData={initialElements ? { elements: initialElements } : undefined}
        onChange={handleChange}
        viewModeEnabled={simStatus === 'running'}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}
