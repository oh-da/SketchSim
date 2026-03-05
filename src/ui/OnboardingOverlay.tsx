import { useUIStore } from '@/store/uiStore';

export default function OnboardingOverlay() {
  const hasDrawn = useUIStore((s) => s.hasDrawn);

  if (hasDrawn) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
      <p className="text-2xl italic text-gray-400 select-none transition-opacity duration-300">
        Draw two lines. Write a number. Press Play.
      </p>
    </div>
  );
}
