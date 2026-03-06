import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { shareToUrl } from '@/utils/lzShare';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Toolbar() {
  const { status, clock, speed, agents, play, pause, reset, setSpeed } =
    useSimulationStore();
  const { mode, metricsVisible, toggleMetrics, addToast } = useUIStore();
  const graph = useNetworkStore((s) => s.graph);
  const elements = useNetworkStore((s) => s.elements);
  const hasEdges = graph !== null && graph.edges.length > 0;
  const isRunning = status === 'running';

  const handlePlay = () => {
    if (!hasEdges) {
      addToast('Draw some roads first, then press Play', 'info');
      return;
    }
    play();
  };

  const handleShare = async () => {
    if (elements.length === 0) {
      addToast('Nothing to share yet', 'info');
      return;
    }
    const result = await shareToUrl(elements);
    if (result === 'url') {
      addToast('Link copied to clipboard', 'info');
    } else if (result === 'clipboard') {
      addToast('Scene too large for URL — link copied to clipboard', 'warn');
    } else {
      addToast('Failed to share', 'error');
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl shadow-md h-12">
      {/* Play / Pause */}
      <button
        onClick={isRunning ? pause : handlePlay}
        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors
          ${hasEdges && !isRunning ? 'bg-blue-500 text-white animate-pulse' : ''}
          ${isRunning ? 'bg-yellow-400 text-black' : ''}
          ${!hasEdges && !isRunning ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : ''}
        `}
      >
        {isRunning ? '⏸' : '▶'}
      </button>

      {/* Reset */}
      <button
        onClick={reset}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
      >
        ⏹
      </button>

      {/* Clock */}
      <span className="font-mono text-sm text-gray-700 min-w-[48px]">
        {formatTime(clock)}
      </span>

      {/* Vehicle count */}
      <span className="text-xs text-gray-500">
        {agents.length} veh
      </span>

      {/* Speed slider */}
      <div className="flex items-center gap-1">
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-20 h-1 accent-blue-500"
        />
        <span className="text-xs text-gray-500 min-w-[28px]">{speed}x</span>
      </div>

      {/* Metrics toggle */}
      <button
        onClick={toggleMetrics}
        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm
          ${metricsVisible ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}
        `}
        title="Toggle metrics"
      >
        👁
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-xs"
        title="Share (copy link)"
      >
        ↗
      </button>

      {/* Status */}
      <div className="flex items-center gap-1">
        <div
          className={`w-2 h-2 rounded-full ${
            mode === 'drawing'
              ? 'bg-gray-400'
              : mode === 'previewing'
                ? 'bg-blue-500'
                : mode === 'simulating'
                  ? 'bg-green-500'
                  : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-gray-500 capitalize">{mode}</span>
      </div>
    </div>
  );
}
