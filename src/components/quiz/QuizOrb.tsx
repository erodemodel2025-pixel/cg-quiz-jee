export type QuizOrbState =
  | 'idle'
  | 'question'
  | 'selected'
  | 'correct'
  | 'incorrect'
  | 'result';

interface QuizOrbProps {
  state: QuizOrbState;
  label?: string;
  compact?: boolean;
}

const ORB_STYLE: Record<
  QuizOrbState,
  {
    core: string;
    ring: string;
    glow: string;
    caption: string;
    pulse: string;
  }
> = {
  idle: {
    core: '#38BDF8',
    ring: 'rgba(56,189,248,0.35)',
    glow: '0 0 14px rgba(56,189,248,0.35)',
    caption: 'READY',
    pulse: 'animate-pulse',
  },
  question: {
    core: '#00F0FF',
    ring: 'rgba(0,240,255,0.45)',
    glow: '0 0 18px rgba(0,240,255,0.45)',
    caption: 'THINKING',
    pulse: '',
  },
  selected: {
    core: '#FFE600',
    ring: 'rgba(255,230,0,0.45)',
    glow: '0 0 18px rgba(255,230,0,0.45)',
    caption: 'LOCKED',
    pulse: '',
  },
  correct: {
    core: '#22FF66',
    ring: 'rgba(34,255,102,0.55)',
    glow: '0 0 20px rgba(34,255,102,0.55)',
    caption: 'VERIFIED',
    pulse: '',
  },
  incorrect: {
    core: '#FF6B00',
    ring: 'rgba(255,107,0,0.5)',
    glow: '0 0 16px rgba(255,107,0,0.4)',
    caption: 'REVIEW',
    pulse: '',
  },
  result: {
    core: '#A855F7',
    ring: 'rgba(168,85,247,0.5)',
    glow: '0 0 22px rgba(168,85,247,0.5)',
    caption: 'ANALYZED',
    pulse: 'animate-pulse',
  },
};

export function QuizOrb({ state, label, compact = false }: QuizOrbProps) {
  const s = ORB_STYLE[state];

  return (
    <div
      className={`inline-flex items-center gap-2.5 border-2 border-[var(--border-pixel)] bg-[var(--surface)] ${
        compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
      }`}
      aria-label={`Quiz status indicator: ${label || s.caption}`}
    >
      <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
        <span
          className={`absolute inset-0 border-2 ${s.pulse}`}
          style={{ borderColor: s.ring }}
        />
        <span
          className="w-3 h-3 border border-black"
          style={{
            backgroundColor: s.core,
            boxShadow: s.glow,
          }}
        />
      </div>
      <div className="text-left leading-tight">
        <div
          className="font-pixel text-[8px] tracking-wider"
          style={{ color: s.core }}
        >
          {label || s.caption}
        </div>
      </div>
    </div>
  );
}
