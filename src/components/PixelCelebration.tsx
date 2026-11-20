import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useArcade } from '../context/ArcadeContext.tsx';

interface PixelCelebrationProps {
  onTriggerDevMode: () => void;
}

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

const DEV_CODE = ['d', 'e', 'v', '7', '7'];

const PIXEL_BITS = [
  { left: '12%', color: '#00F0FF', delay: '0ms' },
  { left: '22%', color: '#FFE600', delay: '60ms' },
  { left: '34%', color: '#22FF66', delay: '120ms' },
  { left: '48%', color: '#A855F7', delay: '30ms' },
  { left: '61%', color: '#FF6B00', delay: '90ms' },
  { left: '74%', color: '#00F0FF', delay: '150ms' },
  { left: '86%', color: '#FFE600', delay: '45ms' },
];

export const PixelCelebration: React.FC<PixelCelebrationProps> = ({ onTriggerDevMode }) => {
  const { celebration, reducedMotion, unlockAchievement } = useArcade();
  const [nightChecked, setNightChecked] = useState(false);

  useEffect(() => {
    let konamiIdx = 0;
    let devIdx = 0;
    let cgPrev = '';

    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D opens hidden Developer Mode directly
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onTriggerDevMode();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Secret "dev77" code
      if (key === DEV_CODE[devIdx]) {
        devIdx++;
        if (devIdx === DEV_CODE.length) {
          devIdx = 0;
          onTriggerDevMode();
        }
      } else {
        devIdx = key === DEV_CODE[0] ? 1 : 0;
      }

      // Konami Easter egg
      if (key === KONAMI[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === KONAMI.length) {
          konamiIdx = 0;
          void unlockAchievement('konami', 'LEGACY CODE CRACKED!');
        }
      } else {
        konamiIdx = key === KONAMI[0] ? 1 : 0;
      }

      // Typing "cg" outside inputs
      if (cgPrev === 'c' && key === 'g') {
        cgPrev = '';
        void unlockAchievement('cpu_key', 'SILICON WHISPER!');
      } else {
        cgPrev = key;
      }

      // Night owl check
      if (!nightChecked) {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 5) {
          setNightChecked(true);
          void unlockAchievement('night_owl', 'MIDNIGHT LAB ENGINEER!');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nightChecked, onTriggerDevMode, unlockAchievement]);

  if (!celebration) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {!reducedMotion && (
        <div className="relative h-6 overflow-visible">
          {PIXEL_BITS.map((b, i) => (
            <span
              key={i}
              className="absolute bottom-0 w-2.5 h-2.5 border border-black animate-bounce"
              style={{
                left: b.left,
                backgroundColor: b.color,
                animationDelay: b.delay,
              }}
            />
          ))}
        </div>
      )}
      <div
        className="pixel-panel px-4 py-3 flex items-center gap-3"
        style={{ borderColor: celebration.color }}
      >
        <div
          className="w-9 h-9 border-2 border-white flex items-center justify-center shrink-0 text-[#04060E]"
          style={{ backgroundColor: celebration.color }}
        >
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-pixel text-[10px] sm:text-xs truncate" style={{ color: celebration.color }}>
            {celebration.title}
          </div>
          <div className="text-xs sm:text-sm text-[var(--text-primary)] truncate mt-0.5">
            {celebration.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
};
