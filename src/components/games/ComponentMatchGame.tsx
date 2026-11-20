import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Cpu, RotateCcw } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import type { ComponentCardDef } from '../../../shared/minigameData.ts';

interface ComponentMatchGameProps {
  onExit: () => void;
}

interface TileItem {
  uid: string;
  compId: string;
  kind: 'name' | 'function';
  label: string;
  sub: string;
  color: string;
}

export const ComponentMatchGame: React.FC<ComponentMatchGameProps> = ({ onExit }) => {
  const { player, setMusicMode, updateLocalPlayer, triggerCelebration, reportError } = useArcade();
  const [sessionId, setSessionId] = useState('');
  const [catalog, setCatalog] = useState<ComponentCardDef[]>([]);
  const [tiles, setTiles] = useState<TileItem[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{ score: number; xpEarned: number } | null>(null);
  const lockRef = useRef(false);
  const startedRef = useRef(false);

  const buildDeck = (items: ComponentCardDef[]): TileItem[] => {
    const raw: TileItem[] = [];
    for (const c of items) {
      raw.push({
        uid: `${c.id}-n`,
        compId: c.id,
        kind: 'name',
        label: c.name,
        sub: c.symbol,
        color: c.color,
      });
      raw.push({
        uid: `${c.id}-f`,
        compId: c.id,
        kind: 'function',
        label: c.functionText,
        sub: 'FUNCTION',
        color: c.color,
      });
    }
    for (let i = raw.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [raw[i], raw[j]] = [raw[j], raw[i]];
    }
    return raw;
  };

  const startGame = useCallback(async () => {
    try {
      const res = await safeFetchJson<{ sessionId: string; items: ComponentCardDef[] }>(
        '/api/minigame/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameType: 'component-match', playerId: player?.id ?? null }),
        }
      );
      const items = res.data?.items;
      if (res.ok && res.data && Array.isArray(items)) {
        // Use 6 pairs (12 cards) for brisk, readable 4x3 grid on desktop and mobile
        const data = res.data;
        const subset = items.slice(0, 6);
        setSessionId(data.sessionId);
        setCatalog(subset);
        setTiles(buildDeck(subset));
        setFlipped([]);
        setMatched(new Set());
        setMistakes(0);
        setStreak(0);
        setBestStreak(0);
        setElapsed(0);
        setFinished(false);
        setResult(null);
        lockRef.current = false;
        soundManager.playGameStart();
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [player?.id, reportError]);

  useEffect(() => {
    setMusicMode(finished ? 'victory' : 'gameplay');
  }, [finished, setMusicMode]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startGame();
    }
  }, [startGame]);

  useEffect(() => {
    if (finished || tiles.length === 0) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [finished, tiles.length]);

  const submitMatchRun = async (finalBestStreak: number, finalMistakes: number) => {
    try {
      const res = await safeFetchJson<{
        score: number;
        xpEarned: number;
        leveledUp?: boolean;
        player?: NonNullable<typeof player>;
      }>('/api/minigame/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId: player?.id ?? null,
          pairsMatched: catalog.length,
          mistakes: finalMistakes,
          bestStreak: finalBestStreak,
        }),
      });
      if (res.ok && res.data) {
        const data = res.data;
        setResult({ score: data.score, xpEarned: data.xpEarned });
        if (data.player) updateLocalPlayer(data.player);
        if (data.leveledUp && data.player) {
          soundManager.playLevelUp();
          triggerCelebration('LEVEL UP!', `Level ${data.player.level} reached!`, '#00F0FF');
        } else {
          soundManager.playVictory();
        }
        setFinished(true);
      }
    } catch (err) {
      reportError(String(err));
    }
  };

  const handleTileClick = (tile: TileItem) => {
    if (lockRef.current || finished) return;
    if (matched.has(tile.compId) || flipped.includes(tile.uid)) return;

    soundManager.playClick();
    const nextFlipped = [...flipped, tile.uid];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      lockRef.current = true;
      const first = tiles.find((t) => t.uid === nextFlipped[0])!;
      const second = tiles.find((t) => t.uid === nextFlipped[1])!;

      if (first.compId === second.compId && first.kind !== second.kind) {
        const nextMatched = new Set(matched);
        nextMatched.add(first.compId);
        const nextStreak = streak + 1;
        const nextBest = Math.max(bestStreak, nextStreak);
        setMatched(nextMatched);
        setStreak(nextStreak);
        setBestStreak(nextBest);
        if (nextStreak >= 2) {
          soundManager.playCombo(nextStreak);
        } else {
          soundManager.playCorrect();
        }

        window.setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
          if (nextMatched.size === catalog.length) {
            void submitMatchRun(nextBest, mistakes);
          }
        }, 350);
      } else {
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setStreak(0);
        soundManager.playWrong();
        window.setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 700);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="pixel-btn pixel-btn-ghost px-3 py-2 text-[10px]"
        >
          <ArrowLeft size={14} /> Arcade Hub
        </button>

        <div className="pixel-panel px-4 py-2 flex items-center gap-4 font-code text-sm tabular-nums">
          <span className="text-[#22FF66]">
            MATCHED {matched.size}/{catalog.length}
          </span>
          <span className="text-[#FFE600]">STREAK {streak}x</span>
          <span className="text-[#FF6B00]">MISS {mistakes}</span>
          <span className="text-[#00F0FF]">{elapsed}s</span>
        </div>
      </div>

      {finished && result ? (
        <div className="pixel-panel p-6 sm:p-8 text-center">
          <Cpu size={38} className="mx-auto text-[#00F0FF] mb-3" />
          <h2 className="font-pixel text-lg sm:text-xl text-[#FFE600] mb-2">
            ALL COMPONENTS MATCHED!
          </h2>
          <p className="text-base text-[var(--text-secondary)] mb-5">
            Score: <strong className="text-[#22FF66]">{result.score}</strong> · Time: {elapsed}s ·
            Mistakes: {mistakes} · +{result.xpEarned} XP
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                void startGame();
              }}
              className="pixel-btn pixel-btn-cyan px-5 py-3 text-xs"
            >
              <RotateCcw size={14} /> Play Again
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onExit();
              }}
              className="pixel-btn pixel-btn-ghost px-5 py-3 text-xs"
            >
              Arcade Hub
            </button>
          </div>

          <div className="text-left grid sm:grid-cols-2 gap-3">
            {catalog.map((c) => (
              <div key={c.id} className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  <span className="font-code text-xs text-[var(--text-muted)]">{c.symbol}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{c.functionText}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pixel-panel p-5">
          <div className="mb-4">
            <h1 className="font-pixel text-sm sm:text-base text-[#00F0FF]">COMPONENT MATCH</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Flip two cards to pair each engineering component with its real circuit function.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tiles.map((tile) => {
              const isRevealed = flipped.includes(tile.uid) || matched.has(tile.compId);
              const isDone = matched.has(tile.compId);

              return (
                <button
                  key={tile.uid}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => handleTileClick(tile)}
                  className={`min-h-[118px] p-3 border-3 text-left flex flex-col justify-between cursor-pointer transition-colors ${
                    isDone
                      ? 'bg-[#0B2E1A] border-[#22FF66]'
                      : isRevealed
                        ? 'bg-[var(--bg-panel-alt)] border-[#FFE600]'
                        : 'bg-[var(--bg-deep)] border-[var(--border-pixel)] hover:border-[#00F0FF]'
                  }`}
                >
                  {isRevealed ? (
                    <>
                      <span
                        className="font-code text-[11px] font-bold"
                        style={{ color: tile.color }}
                      >
                        {tile.sub}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] leading-snug">
                        {tile.label}
                      </span>
                    </>
                  ) : (
                    <div className="m-auto text-center">
                      <div className="font-pixel text-sm text-[var(--border-pixel)]">?</div>
                      <div className="font-code text-[10px] text-[var(--text-muted)] mt-1">
                        CG-CHIP
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
