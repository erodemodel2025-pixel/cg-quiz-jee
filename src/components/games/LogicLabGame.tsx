import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BrainCircuit, CheckCircle2, Flame, RotateCcw, XCircle } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import type { LogicPuzzle } from '../../../shared/minigameData.ts';

interface LogicLabGameProps {
  onExit: () => void;
}

type PublicLogicPuzzle = Omit<LogicPuzzle, 'correctIndex' | 'explanation'>;

export const LogicLabGame: React.FC<LogicLabGameProps> = ({ onExit }) => {
  const { player, setMusicMode, updateLocalPlayer, triggerCelebration, reportError } = useArcade();
  const [sessionId, setSessionId] = useState('');
  const [puzzles, setPuzzles] = useState<PublicLogicPuzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Array<{ id: string; selectedIndex: number }>>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    totalQuestions: number;
    xpEarned: number;
    details: Array<{ id: string; title: string; correct: boolean; explanation: string }>;
  } | null>(null);
  const startedRef = useRef(false);

  const startLab = useCallback(async () => {
    try {
      const res = await safeFetchJson<{ sessionId: string; items: PublicLogicPuzzle[] }>(
        '/api/minigame/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameType: 'logic-lab', playerId: player?.id ?? null }),
        }
      );
      const items = res.data?.items;
      if (res.ok && res.data && Array.isArray(items)) {
        const data = res.data;
        setSessionId(data.sessionId);
        setPuzzles(items);
        setIdx(0);
        setAnswers([]);
        setPicked(null);
        setStreak(0);
        setFeedback(null);
        setFinished(false);
        setResult(null);
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
      void startLab();
    }
  }, [startLab]);

  const submitLab = async (finalAnswers: Array<{ id: string; selectedIndex: number }>) => {
    try {
      const res = await safeFetchJson<{
        score: number;
        correctCount: number;
        totalQuestions: number;
        xpEarned: number;
        leveledUp?: boolean;
        player?: NonNullable<typeof player>;
        details: Array<{ id: string; title: string; correct: boolean; explanation: string }>;
      }>('/api/minigame/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId: player?.id ?? null,
          answers: finalAnswers,
        }),
      });
      if (res.ok && res.data) {
        const data = res.data;
        setResult(data);
        if (data.player) updateLocalPlayer(data.player);
        if (data.leveledUp && data.player) {
          soundManager.playLevelUp();
          triggerCelebration('LEVEL UP!', `Level ${data.player.level}: ${data.player.title}`, '#A855F7');
        } else if (data.correctCount >= 3) {
          soundManager.playVictory();
        } else {
          soundManager.playGameOver();
        }
        setFinished(true);
      }
    } catch (err) {
      reportError(String(err));
    }
  };

  const choose = async (optIdx: number) => {
    if (picked !== null || !puzzles[idx]) return;
    const current = puzzles[idx];
    setPicked(optIdx);
    soundManager.playClick();

    const next = [...answers, { id: current.id, selectedIndex: optIdx }];
    setAnswers(next);

    try {
      const res = await safeFetchJson<{
        correct: boolean;
        correctIndex: number;
        explanation: string;
      }>('/api/minigame/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, itemId: current.id, selectedIndex: optIdx }),
      });
      if (!res.ok || !res.data) {
        reportError(res.error || 'Answer check failed');
        return;
      }
      const check = res.data;
      setFeedback(check);
      if (check.correct) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        if (nextStreak >= 3) {
          soundManager.playCombo(nextStreak);
        } else {
          soundManager.playCorrect();
        }
      } else {
        setStreak(0);
        soundManager.playWrong();
      }
    } catch (err) {
      reportError(String(err));
    }
  };

  const handleNext = () => {
    soundManager.playClick();
    if (idx + 1 < puzzles.length) {
      setIdx((i) => i + 1);
      setPicked(null);
      setFeedback(null);
    } else {
      void submitLab(answers);
    }
  };

  if (puzzles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center font-pixel text-xs text-[#A855F7]">
        CALIBRATING LOGIC LAB...
      </div>
    );
  }

  if (finished && result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="pixel-panel p-6 sm:p-8 mb-6 text-center">
          <BrainCircuit size={38} className="mx-auto text-[#A855F7] mb-3" />
          <h2 className="font-pixel text-lg sm:text-xl text-[#FFE600] mb-2">
            LOGIC LAB COMPLETE — {result.score} PTS
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] mb-5">
            {result.correctCount}/{result.totalQuestions} solved · +{result.xpEarned} XP
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                void startLab();
              }}
              className="pixel-btn pixel-btn-purple px-5 py-3 text-xs"
            >
              <RotateCcw size={14} /> New Lab Run
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
        </div>

        <div className="pixel-panel p-5 space-y-3">
          <div className="font-pixel text-xs text-[#00F0FF] mb-2">LAB SOLUTIONS</div>
          {result.details.map((d) => (
            <div key={d.id} className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-sm">{d.title}</span>
                {d.correct ? (
                  <span className="text-[#22FF66] flex items-center gap-1 font-pixel text-[10px]">
                    <CheckCircle2 size={14} /> SOLVED
                  </span>
                ) : (
                  <span className="text-[#FF6B6B] flex items-center gap-1 font-pixel text-[10px]">
                    <XCircle size={14} /> MISSED
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{d.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const p = puzzles[idx];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
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
        <div className="pixel-panel px-4 py-2 font-code text-sm flex items-center gap-3 tabular-nums">
          <span className="text-[#FFE600] flex items-center gap-1">
            <Flame size={14} /> {streak}x
          </span>
          <span className="text-[#A855F7]">
            LAB {idx + 1}/{puzzles.length} · {p.topic}
          </span>
        </div>
      </div>

      <div className="pixel-panel p-5 sm:p-7">
        <div className="font-pixel text-xs text-[#FFE600] mb-3">{p.title}</div>
        <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-5">
          {p.prompt}
        </p>

        {p.gateChallenge && (
          <div className="bg-[var(--bg-deep)] border-3 border-[#A855F7] p-4 mb-5 flex items-center justify-center gap-4 font-code text-sm">
            <div className="space-y-2 text-right">
              <div className="px-2.5 py-1 bg-[#121A36] border-2 border-[#00F0FF]">
                A = <strong className="text-[#FFE600]">{p.gateChallenge.inputA}</strong>
              </div>
              <div className="px-2.5 py-1 bg-[#121A36] border-2 border-[#00F0FF]">
                B = <strong className="text-[#FFE600]">{p.gateChallenge.inputB}</strong>
              </div>
            </div>
            <div className="text-[#00F0FF]">──▶</div>
            <div className="px-5 py-4 bg-[#27134D] border-3 border-[#A855F7] font-pixel text-xs text-white">
              {p.gateChallenge.gate}
            </div>
            <div className="text-[#00F0FF]">──▶</div>
            <div className="px-3 py-2 bg-[#121A36] border-2 border-[#FFE600] font-pixel text-xs text-[#FFE600]">
              Q = ?
            </div>
          </div>
        )}

        {p.diagramLines && (
          <div className="bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] p-4 mb-5 font-code text-sm text-[#00F0FF] text-center">
            {p.diagramLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {p.options.map((opt, i) => {
            const isChosen = picked === i;
            const isCorrect = feedback?.correctIndex === i;
            let cls =
              'bg-[var(--bg-deep)] text-[var(--text-primary)] border-[var(--border-pixel)] hover:border-[#A855F7]';
            if (feedback) {
              if (isCorrect) cls = 'bg-[#0B2E1A] text-[#DCFFE8] border-[#22FF66]';
              else if (isChosen && !isCorrect) cls = 'bg-[#361014] text-[#FFD6D6] border-[#FF5252]';
              else cls = 'bg-[var(--bg-deep)] text-[var(--text-muted)] border-[var(--border-pixel)]';
            }

            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => void choose(i)}
                className={`p-4 border-3 text-left font-medium cursor-pointer transition-colors min-h-[52px] ${cls}`}
              >
                <span className="font-pixel text-[10px] text-[#FFE600] mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`mt-5 p-4 border-2 ${
              feedback.correct ? 'bg-[#0B2E1A] border-[#22FF66]' : 'bg-[#361014] border-[#FF5252]'
            }`}
          >
            <div className="font-pixel text-[10px] mb-1.5">
              {feedback.correct ? (
                <span className="text-[#22FF66]">LOGIC VERIFIED!</span>
              ) : (
                <span className="text-[#FF6B6B]">LOGIC MISMATCH</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-primary)] mb-3">
              {feedback.explanation}
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="pixel-btn pixel-btn-yellow px-5 py-2.5 text-[10px]"
            >
              {idx + 1 < puzzles.length ? 'Next Puzzle' : 'Finish & Claim XP'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
