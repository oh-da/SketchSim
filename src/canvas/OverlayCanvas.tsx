import { useRef, useEffect, useCallback } from 'react';
import type { ViewportTransform } from './ExcalidrawWrapper';

interface OverlayCanvasProps {
  viewportRef: React.MutableRefObject<ViewportTransform>;
  onRender?: (ctx: CanvasRenderingContext2D, viewport: ViewportTransform) => void;
}

export default function OverlayCanvas({ viewportRef, onRender }: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const { scrollX, scrollY, zoom } = viewportRef.current;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply HiDPI + viewport transform
      ctx.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        -scrollX * zoom * dpr,
        -scrollY * zoom * dpr,
      );

      onRender?.(ctx, viewportRef.current);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [viewportRef, onRender]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
