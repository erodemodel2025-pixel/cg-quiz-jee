import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Flame, RotateCcw, ShieldCheck, Timer, Trophy, XCircle } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import { ENGINEERING_CATEGORIES } from '../../../shared/categories.ts';
import type { AnswerDetail, Difficulty, PublicQuestion, QuizMode } from '../../../shared/types.ts';

interface EngineeringIQQuizProps {
  initialMode?: QuizMode;
  onExit: () => void;
  onRequireRegister: () => void;
}

type Stage = 'setup' | 'playing' | 'results';

export const EngineeringIQQuiz: React.FC<EngineeringIQQuizProps> = ({
  initialMode = 'practice',
  onExit,
  onRequireRegister,
}) => {
  const { player, setMusicMode, updateLocalPlayer, triggerCelebration, reportError } = useArcade();
  const [stage, setStage] = useState<Stage>('setup');
  const [mode, setMode] = useState<QuizMode>(initialMode);
  const [categoryId, setCategoryId] = useState<string>('cs');
  const [difficulty, setDifficulty] = useState<Difficulty | 'MIXED'>('MIXED');

  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    correctIndex: number;
    explanation: string;
    reference: string;
  } | null>(null);

  const [answers, setAnswers] = useState<Array<{ questionId: string; selectedIndex: number; timeMs: number }>>([]);
  const [streak, setStreak] = useState(0);
  const [liveScore, setLiveScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    totalQuestions: number;
    accuracy: number;
    timeSpentSeconds: number;
    maxStreak: number;
    xpEarned: number;
    details: AnswerDetail[];
  } | null>(null);

  const questionStartRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    setMusicMode(stage === 'playing' ? 'gameplay' : stage === 'results' ? 'victory' : 'home');
  }, [stage, setMusicMode]);

  useEffect(() => {
    if (stage !== 'playing') return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void finishQuiz(answers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const startQuiz = async (chosenMode: QuizMode = mode) => {
    if (!player) {
      soundManager.playWrong();
      onRequireRegister();
      return;
    }

    setLoading(true);
    submittedRef.current = false;
    try {
      const res = await safeFetchJson<{
        sessionId: string;
        questions: PublicQuestion[];
        timeLimitSeconds?: number;
        error?: string;
      }>('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: chosenMode,
          gameType: 'iq-quiz',
          categoryId: chosenMode === 'competitive' ? 'all' : categoryId,
          difficulty: chosenMode === 'competitive' ? 'MIXED' : difficulty,
          playerId: player?.id ?? null,
        }),
      });
      if (!res.ok || !res.data || !Array.isArray(res.data.questions)) {
        reportError(res.error || 'Failed to start quiz');
        setLoading(false);
        return;
      }

      const data = res.data;
      soundManager.playGameStart();
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setIndex(0);
      setSelected(null);
      setFeedback(null);
      setAnswers([]);
      setStreak(0);
      setLiveScore(0);
      setTimeLeft(data.timeLimitSeconds || 150);
      questionStartRef.current = Date.now();
      setStage('playing');
    } catch (err) {
      reportError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (optIdx: number) => {
    if (selected !== null || !questions[index]) return;
    const q = questions[index];
    const timeMs = Date.now() - questionStartRef.current;
    setSelected(optIdx);

    try {
      const res = await safeFetchJson<{
        correct: boolean;
        correctIndex: number;
        explanation: string;
        reference: string;
      }>('/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: q.id, selectedIndex: optIdx }),
      });
      if (!res.ok || !res.data) {
        reportError(res.error || 'Failed to verify answer');
        return;
      }
      const data = res.data;
      setFeedback(data);

      const nextAnswers = [...answers, { questionId: q.id, selectedIndex: optIdx, timeMs }];
      setAnswers(nextAnswers);

      if (data.correct) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setLiveScore((s) => s + 100 + (nextStreak - 1) * 20);
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

  const finishQuiz = async (finalAnswers = answers) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setLoading(true);
    try {
      const res = await safeFetchJson<{
        score: number;
        accuracy: number;
        correctCount: number;
        totalQuestions: number;
        timeSpentSeconds: number;
        maxStreak: number;
        xpEarned: number;
        leveledUp?: boolean;
        dailyCompletedNow?: boolean;
        details: AnswerDetail[];
        player?: NonNullable<typeof player>;
      }>('/api/quiz/submit', {
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
          triggerCelebration('LEVEL UP!', `Reached Level ${data.player.level}: ${data.player.title}`, '#22FF66');
        } else {
          if (data.accuracy >= 60) {
            soundManager.playVictory();
          } else {
            soundManager.playGameOver();
          }
          if (data.dailyCompletedNow) {
            triggerCelebration('DAILY CHALLENGE CLEAR!', `+Bonus XP awarded`, '#FFE600');
          }
        }
        setStage('results');
      } else {
        submittedRef.current = false;
        reportError(res.error || 'Score submission was rejected by server.');
      }
    } catch (err) {
      submittedRef.current = false;
      reportError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    soundManager.playClick();
    if (index + 1 >= questions.length) {
      void finishQuiz(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    questionStartRef.current = Date.now();
  };

  if (stage === 'setup') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="pixel-btn pixel-btn-ghost px-3 py-2 text-[10px] mb-6"
        >
          <ArrowLeft size={14} /> Arcade Hub
        </button>

        <div className="pixel-panel p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-pixel text-lg sm:text-xl text-[#00F0FF] mb-2">
                ENGINEERING IQ QUIZ
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                Choose Practice Mode to drill a specific engineering branch, or Live Competition Mode for global leaderboard ranking.
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setMode('practice');
              }}
              className={`p-4 text-left border-3 cursor-pointer transition-colors ${
                mode === 'practice'
                  ? 'bg-[var(--bg-panel-alt)] border-[#00F0FF]'
                  : 'bg-[var(--bg-deep)] border-[var(--border-pixel)] hover:border-[var(--text-muted)]'
              }`}
            >
              <div className="font-pixel text-xs text-[#00F0FF] mb-1.5">PRACTICE MODE</div>
              <p className="text-sm text-[var(--text-secondary)]">
                Select any engineering discipline and difficulty. Instant explanations + Practice records.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setMode('competitive');
              }}
              className={`p-4 text-left border-3 cursor-pointer transition-colors ${
                mode === 'competitive'
                  ? 'bg-[var(--bg-panel-alt)] border-[#FFE600]'
                  : 'bg-[var(--bg-deep)] border-[var(--border-pixel)] hover:border-[var(--text-muted)]'
              }`}
            >
              <div className="font-pixel text-xs text-[#FFE600] mb-1.5 flex items-center gap-2">
                <Trophy size={14} /> LIVE COMPETITION
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                10 randomized cross-domain questions · 150s timer · Server-validated Competitive Leaderboard.
              </p>
            </button>
          </div>

          {mode === 'practice' && (
            <>
              <div className="mb-5">
                <div className="font-pixel text-[10px] text-[var(--text-secondary)] mb-3">
                  SELECT DISCIPLINE
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {ENGINEERING_CATEGORIES.map((cat) => {
                    const active = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          soundManager.playClick();
                          setCategoryId(cat.id);
                        }}
                        className={`p-3 text-left border-2 cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--bg-panel-alt)] border-[#FFE600]'
                            : 'bg-[var(--bg-deep)] border-[var(--border-pixel)] hover:border-[var(--accent-primary)]'
                        }`}
                      >
                        <div className="text-xs font-bold" style={{ color: cat.color }}>
                          {cat.shortName}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                          {cat.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <div className="font-pixel text-[10px] text-[var(--text-secondary)] mb-3">
                  DIFFICULTY
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['MIXED', 'EASY', 'NORMAL', 'HARD', 'EXPERT'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        setDifficulty(d);
                      }}
                      className={`px-3.5 py-2 text-xs font-bold border-2 cursor-pointer ${
                        difficulty === d
                          ? 'bg-[#22FF66] text-[#04060E] border-white'
                          : 'bg-[var(--bg-deep)] text-[var(--text-secondary)] border-[var(--border-pixel)]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'competitive' && !player && (
            <div className="mb-6 p-4 bg-[#2A1D06] border-2 border-[#FFE600] text-sm text-[#FFF3B0]">
              Competitive mode requires a registered Player Name and Class so your official ranking can be verified.
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              soundManager.playClick();
              void startQuiz(mode);
            }}
            className={`pixel-btn px-7 py-4 text-xs sm:text-sm ${
              mode === 'competitive' ? 'pixel-btn-yellow' : 'pixel-btn-cyan'
            }`}
          >
            {loading
              ? 'Loading...'
              : mode === 'competitive' && !player
                ? 'Register to Compete'
                : mode === 'competitive'
                  ? 'Enter Live Competition'
                  : 'Start Practice Run'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'playing' && questions[index]) {
    const q = questions[index];
    const pct = Math.round(((index + (feedback ? 1 : 0)) / questions.length) * 100);

    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* HUD Bar */}
        <div className="pixel-panel p-3 sm:p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="font-code text-sm font-bold text-[#00F0FF] tabular-nums">
            Q {index + 1}/{questions.length} · {q.difficulty}
          </div>
          <div className="flex items-center gap-4 font-code text-sm tabular-nums">
            <span className="flex items-center gap-1 text-[#FFE600]">
              <Flame size={15} /> {streak}x
            </span>
            <span className="text-[#22FF66] font-bold">SCORE {liveScore}</span>
            <span
              className={`flex items-center gap-1 font-bold ${
                timeLeft <= 20 ? 'text-[#FF6B6B]' : 'text-[var(--text-primary)]'
              }`}
            >
              <Timer size={15} /> {timeLeft}s
            </span>
          </div>
        </div>

        {/* Pixel progress bar */}
        <div className="h-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] mb-6">
          <div
            className="h-full bg-[#00F0FF] transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="pixel-panel p-5 sm:p-7 mb-5">
          <div className="text-xs font-code text-[var(--text-muted)] mb-2 uppercase">
            {ENGINEERING_CATEGORIES.find((c) => c.id === q.categoryId)?.name || q.categoryId}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug">
            {q.question}
          </h2>
        </div>

        {/* 4 Answer Options */}
        <div className="space-y-3 mb-6">
          {q.options.map((opt, i) => {
            const isChosen = selected === i;
            const isCorrect = feedback?.correctIndex === i;
            let boxStyle =
              'bg-[var(--bg-panel)] border-[var(--border-pixel)] hover:border-[#00F0FF] text-[var(--text-primary)]';
            if (feedback) {
              if (isCorrect) {
                boxStyle = 'bg-[#0B2E1A] border-[#22FF66] text-[#DCFFE8]';
              } else if (isChosen && !isCorrect) {
                boxStyle = 'bg-[#361014] border-[#FF5252] text-[#FFD6D6]';
              } else {
                boxStyle = 'bg-[var(--bg-deep)] border-[var(--border-pixel)] text-[var(--text-muted)]';
              }
            }

            return (
              <button
                key={i}
                type="button"
                disabled={selected !== null}
                onClick={() => void handleSelectOption(i)}
                className={`w-full p-4 border-3 text-left flex items-center gap-3 cursor-pointer transition-colors min-h-[52px] ${boxStyle}`}
              >
                <span className="font-pixel text-xs px-2.5 py-1.5 bg-[var(--bg-deep)] border-2 border-current shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm sm:text-base font-medium flex-1">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Instant Explanation */}
        {feedback && (
          <div
            className={`pixel-panel p-4 sm:p-5 mb-5 ${
              feedback.correct ? 'border-[#22FF66]' : 'border-[#FF5252]'
            }`}
          >
            <div className="flex items-center gap-2 font-pixel text-xs mb-2">
              {feedback.correct ? (
                <span className="text-[#22FF66] flex items-center gap-2">
                  <CheckCircle2 size={16} /> CORRECT!
                </span>
              ) : (
                <span className="text-[#FF6B6B] flex items-center gap-2">
                  <XCircle size={16} /> INCORRECT
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base text-[var(--text-primary)] mb-2">
              {feedback.explanation}
            </p>
            <div className="text-xs text-[var(--text-muted)] font-code">
              Ref: {feedback.reference}
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="pixel-btn pixel-btn-yellow px-6 py-3 text-xs"
              >
                {index + 1 < questions.length ? 'Next Question' : 'Submit & View Results'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Results Screen
  if (stage === 'results' && result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="pixel-panel p-6 sm:p-8 mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-[#22FF66] font-pixel text-xs mb-3">
            <ShieldCheck size={16} /> SERVER-VALIDATED RUN
          </div>
          <h2 className="font-pixel text-xl sm:text-2xl text-[#FFE600] mb-2">
            SCORE: {result.score}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {result.correctCount}/{result.totalQuestions} correct · {result.accuracy}% accuracy ·{' '}
            {result.timeSpentSeconds}s · +{result.xpEarned} XP
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                void startQuiz(mode);
              }}
              className="pixel-btn pixel-btn-cyan px-5 py-3 text-xs"
            >
              <RotateCcw size={14} /> Play Again
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setStage('setup');
              }}
              className="pixel-btn pixel-btn-ghost px-5 py-3 text-xs"
            >
              Change Topic
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

        {/* Full Answer Breakdown */}
        <div className="pixel-panel p-5 sm:p-6">
          <h3 className="font-pixel text-xs text-[#00F0FF] mb-4">ANSWER EXPLANATIONS</h3>
          <div className="space-y-4">
            {result.details.map((d, idx) => (
              <div
                key={d.questionId}
                className="p-4 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-[var(--text-primary)]">
                    {idx + 1}. {d.question}
                  </span>
                  <span
                    className={`font-pixel text-[10px] shrink-0 ${
                      d.correct ? 'text-[#22FF66]' : 'text-[#FF6B6B]'
                    }`}
                  >
                    {d.correct ? 'PASS' : 'MISS'}
                  </span>
                </div>
                <div className="text-xs text-[#22FF66] mb-1">
                  Correct Answer: {d.options[d.correctIndex]}
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{d.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
