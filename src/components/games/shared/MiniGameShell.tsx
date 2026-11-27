import React, { useState } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';

interface MiniGameShellProps {
  title: string;
  subtitle?: string;
  howToPlay: string;
  controlsSummary: string;
  elapsedSeconds: number;
  score: number;
  personalBest: number | null;
  globalRank: number | null;
  rankUnavailable?: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onExit: () => void;
  accentColor?: string;
  extraHudBadge?: string;
  children: React.ReactNode;
}

export const MiniGameShell: React.FC<MiniGameShellProps> = ({
  title,
  subtitle,
  howToPlay,
  controlsSummary,
  elapsedSeconds,
  score,
  personalBest,
  globalRank,
  rankUnavailable,
  isPaused,
  onTogglePause,
  onRestart,
  onExit,
  accentColor = '#0EA5E9',
  extraHudBadge,
  children,
}) => {
  const {
    soundEnabled,
    toggleSound,
    musicEnabled,
    toggleMusic,
    graphicsQuality,
    setGraphicsQuality,
    reducedMotion,
    toggleReducedMotion,
  } = useArcade();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = Math.floor(elapsedSeconds % 60);
  const timeText = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Consistent Top HUD Bar */}
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onExit();
            }}
            className="studio-btn studio-btn-ghost px-3 py-2 min-h-[44px] text-xs"
            aria-label="Back to Playground"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Exit</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[var(--studio-text)] truncate">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="text-xs text-[var(--studio-text-secondary)] truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Live Telemetry HUD Strip */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {extraHudBadge && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface-2)] border border-[var(--studio-border)] font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
              {extraHudBadge}
            </div>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-[var(--studio-surface-2)] border border-[var(--studio-border)] text-center">
            <div className="font-mono-tech text-[10px] text-[var(--studio-text-muted)]">TIME</div>
            <div className="font-mono-tech text-sm font-bold text-[var(--studio-text)] tabular-nums">
              {timeText}
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[var(--studio-surface-2)] border border-[var(--studio-border)] text-center">
            <div className="font-mono-tech text-[10px] text-[var(--studio-text-muted)]">SCORE</div>
            <div className="font-mono-tech text-sm font-bold text-[var(--studio-accent-text)] tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>

          <div className="hidden sm:block px-3 py-1.5 rounded-lg bg-[var(--studio-surface-2)] border border-[var(--studio-border)] text-center">
            <div className="font-mono-tech text-[10px] text-[var(--studio-text-muted)]">PB / RANK</div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-text)] tabular-nums">
              {personalBest !== null ? personalBest.toLocaleString() : '—'} ·{' '}
              {rankUnavailable ? 'Unranked' : globalRank ? `#${globalRank}` : '—'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setSettingsOpen(false);
              onTogglePause();
            }}
            className="studio-btn studio-btn-ghost px-3 py-2 min-h-[44px] text-xs"
            aria-label={isPaused ? 'Resume game' : 'Pause game'}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* Compact How-to-Play Legend */}
      <div className="px-3.5 py-2.5 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-start sm:items-center gap-2 text-[var(--studio-text-secondary)]">
          <HelpCircle size={15} className="text-[var(--studio-accent-text)] shrink-0 mt-0.5 sm:mt-0" />
          <span>{howToPlay}</span>
        </div>
        <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text)]">
          {controlsSummary}
        </div>
      </div>

      {/* Main Playfield + Pause Modal Overlay */}
      <div className="relative">
        {children}

        {isPaused && (
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Game Paused"
          >
            <div className="w-full max-w-sm studio-card-solid border-2 border-[var(--studio-border-strong)] p-6 space-y-4">
              <div className="text-center">
                <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                  SIMULATION PAUSED
                </div>
                <h2 className="font-heading text-2xl font-bold text-[var(--studio-text)] mt-1">
                  {title}
                </h2>
              </div>

              {!settingsOpen ? (
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      onTogglePause();
                    }}
                    className="studio-btn studio-btn-primary w-full py-3 min-h-[44px]"
                  >
                    <Play size={16} />
                    <span>RESUME</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      onTogglePause();
                      onRestart();
                    }}
                    className="studio-btn studio-btn-cyan w-full py-3 min-h-[44px]"
                  >
                    <RotateCcw size={16} />
                    <span>RESTART</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setSettingsOpen(true);
                    }}
                    className="studio-btn studio-btn-ghost w-full py-3 min-h-[44px]"
                  >
                    <Settings size={16} />
                    <span>SETTINGS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      onExit();
                    }}
                    className="studio-btn studio-btn-ghost w-full py-3 min-h-[44px] text-[var(--studio-rose-text)]"
                  >
                    <ArrowLeft size={16} />
                    <span>EXIT TO ARENA</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSound()}
                      className="studio-btn studio-btn-ghost py-2.5 min-h-[44px] text-xs"
                    >
                      {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                      <span>{soundEnabled ? 'SFX: ON' : 'SFX: OFF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMusic()}
                      className="studio-btn studio-btn-ghost py-2.5 min-h-[44px] text-xs"
                    >
                      <Zap size={15} />
                      <span>{musicEnabled ? 'BGM: ON' : 'BGM: OFF'}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl studio-well space-y-2">
                    <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                      GRAPHICS QUALITY
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setGraphicsQuality(q);
                          }}
                          className={`py-2 rounded-lg font-mono-tech text-xs font-bold uppercase cursor-pointer border ${
                            graphicsQuality === q
                              ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                              : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)]'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      toggleReducedMotion();
                    }}
                    className="studio-btn studio-btn-ghost w-full py-2.5 min-h-[44px] text-xs"
                  >
                    <span>Reduced Motion: {reducedMotion ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="studio-btn studio-btn-primary w-full py-2.5 min-h-[44px] text-xs"
                  >
                    Back to Pause Menu
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
