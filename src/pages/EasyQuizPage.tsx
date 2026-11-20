import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Atom,
  BookOpen,
  Car,
  CheckCircle2,
  Clock,
  Cog,
  Cpu,
  Flame,
  FlaskConical,
  Globe,
  Layers,
  Play,
  ShieldCheck,
  Sigma,
  SkipForward,
  Sparkles,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  DIFFICULTY_MAP,
  GAME_CATEGORIES,
  GAME_DIFFICULTY_CONFIGS,
} from '../../shared/smartQuestionBank.ts';
import type {
  GameCategoryId,
  GameDifficultyId,
  GameResultPayload,
  PublicSmartQuestion,
} from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { GamePodiumResults } from '../components/quiz/GamePodiumResults.tsx';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';

interface EasyQuizPageProps {
  onOpenAdvancedStudio: () => void;
  onOpenArena: () => void;
  onOpenLeaderboard: () => void;
  onRequireRegister: () => void;
}

type Stage = 'select' | 'playing' | 'submitting' | 'results';

const LAST_SESSION_STORAGE_KEY = 'cgquiz_last_game_session';
const SETTINGS_STORAGE_KEY = 'cgquiz_smart_quiz_settings';

interface PersistedSettings {
  difficulty: GameDifficultyId;
  category: GameCategoryId;
  questionCount: number;
  timeLimitSeconds: number;
}

function loadSavedSettings(): PersistedSettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      if (parsed.difficulty && parsed.difficulty in DIFFICULTY_MAP) {
        return {
          difficulty: parsed.difficulty,
          category: (parsed.category || 'all') as GameCategoryId,
          questionCount: [5, 10, 15, 20].includes(Number(parsed.questionCount))
            ? Number(parsed.questionCount)
            : 10,
          timeLimitSeconds: [0, 180, 300, 600].includes(Number(parsed.timeLimitSeconds))
            ? Number(parsed.timeLimitSeconds)
            : 300,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    difficulty: 'easy',
    category: 'all',
    questionCount: 10,
    timeLimitSeconds: 300,
  };
}

function getCategoryIcon(id: GameCategoryId) {
  switch (id) {
    case 'physics':
      return Atom;
    case 'chemistry':
      return FlaskConical;
    case 'mathematics':
      return Sigma;
    case 'computer-science':
      return Cpu;
    case 'engineering':
      return Cog;
    case 'automobile':
      return Car;
    case 'general-stem':
      return Globe;
    default:
      return Layers;
  }
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export const EasyQuizPage: React.FC<EasyQuizPageProps> = ({
  onOpenAdvancedStudio,
  onOpenArena,
  onOpenLeaderboard,
  onRequireRegister,
}) => {
  const { player, updateLocalPlayer, triggerCelebration, setMusicMode, reportError } = useArcade();

  const initialSettings = loadSavedSettings();
  const [difficulty, setDifficulty] = useState<GameDifficultyId>(initialSettings.difficulty);
  const [category, setCategory] = useState<GameCategoryId>(initialSettings.category);
  const [questionCount, setQuestionCount] = useState<number>(initialSettings.questionCount);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(initialSettings.timeLimitSeconds);

  const [stage, setStage] = useState<Stage>('select');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Active Game Session State
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<PublicSmartQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [instantFeedback, setInstantFeedback] = useState<{
    correct: boolean;
    correctIndex: number;
    explanation: string;
    pointsAwarded: number;
  } | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, number>>({});
  const [correctSoFar, setCorrectSoFar] = useState(0);
  const [wrongSoFar, setWrongSoFar] = useState(0);
  const [streak, setStreak] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resultPayload, setResultPayload] = useState<GameResultPayload | null>(null);

  const submittedSessionRef = useRef<string>('');
  const answersMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ difficulty, category, questionCount, timeLimitSeconds })
      );
    } catch {
      // ignore
    }
  }, [difficulty, category, questionCount, timeLimitSeconds]);

  // Restore saved result on browser refresh without ever re-submitting!
  useEffect(() => {
    try {
      const savedSessionId = sessionStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (savedSessionId && stage === 'select' && !resultPayload) {
        void safeFetchJson<GameResultPayload>(
          `/api/game/result/${encodeURIComponent(savedSessionId)}`
        ).then((res) => {
          if (res.ok && res.data && res.data.sessionId === savedSessionId) {
            if (!player || res.data.userId === player.id) {
              setResultPayload(res.data);
              setStage('results');
            }
          }
        });
      }
    } catch {
      // ignore
    }
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset quiz/results immediately if user logs out
  useEffect(() => {
    if (!player && stage !== 'select') {
      submittedSessionRef.current = '';
      answersMapRef.current = {};
      setSessionId('');
      setQuestions([]);
      setAnswersMap({});
      setInstantFeedback(null);
      setResultPayload(null);
      setStage('select');
    }
  }, [player, stage]);

  useEffect(() => {
    if (stage === 'playing' || stage === 'submitting') setMusicMode('focus');
    else if (stage === 'results') setMusicMode('victory');
    else setMusicMode('home');
  }, [stage, setMusicMode]);

  const finishAndSubmitGame = useCallback(
    async (overrideMap?: Record<string, number>) => {
      if (!sessionId || !player) return;
      if (submittedSessionRef.current === sessionId) return;
      submittedSessionRef.current = sessionId;

      setSubmitError('');
      setStage('submitting');

      const mapToUse = overrideMap || answersMapRef.current;
      const answersPayload = questions.map((q) => ({
        questionId: q.id,
        selectedIndex: mapToUse[q.id] ?? -1,
      }));

      try {
        const res = await safeFetchJson<GameResultPayload & { error?: string }>('/api/game/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: player.id,
            answers: answersPayload,
          }),
        });

        if (!res.ok || !res.data || typeof res.data.score !== 'number') {
          submittedSessionRef.current = '';
          const msg = res.error || res.data?.error || 'Failed to save score to database.';
          setSubmitError(msg);
          reportError(msg);
          setStage('playing');
          return;
        }

        const saved = res.data;
        try {
          sessionStorage.setItem(LAST_SESSION_STORAGE_KEY, saved.sessionId);
        } catch {
          // ignore
        }

        if (saved.player) updateLocalPlayer(saved.player);

        if (saved.enteredTop3Highest || saved.enteredTop3Overall) {
          arcadeAudio.playSfx('airhorn');
          triggerCelebration(
            'PODIUM FINISH!',
            `#${saved.highestRank ?? 1} on the Live Championship Podium!`,
            '#FBBF24'
          );
        } else if (saved.leveledUp && saved.player) {
          arcadeAudio.playSfx('levelUp');
          triggerCelebration(
            'LEVEL UP!',
            `Level ${saved.player.level}: ${saved.player.title}`,
            '#34D399'
          );
        } else {
          arcadeAudio.playSfx(saved.accuracy >= 60 ? 'victory' : 'baDumTss');
        }

        setResultPayload(saved);
        setStage('results');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        submittedSessionRef.current = '';
        const msg = err instanceof Error ? err.message : 'Score save error.';
        setSubmitError(msg);
        reportError(msg);
        setStage('playing');
      }
    },
    [player, questions, reportError, sessionId, triggerCelebration, updateLocalPlayer]
  );

  // Countdown Timer when timeLimitSeconds > 0
  useEffect(() => {
    if (stage !== 'playing' || timeLimitSeconds <= 0) return;
    if (secondsLeft <= 0) {
      void finishAndSubmitGame();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [finishAndSubmitGame, secondsLeft, stage, timeLimitSeconds]);

  const startGame = useCallback(
    async (chosenDiff: GameDifficultyId = difficulty) => {
      if (!player) {
        arcadeAudio.playSfx('wrong');
        onRequireRegister();
        return;
      }

      setDifficulty(chosenDiff);
      setStarting(true);
      setStartError('');
      setSubmitError('');

      try {
        sessionStorage.removeItem(LAST_SESSION_STORAGE_KEY);
      } catch {
        // ignore
      }

      try {
        const res = await safeFetchJson<{
          sessionId: string;
          questions: PublicSmartQuestion[];
          timeLimitSeconds: number;
          error?: string;
        }>('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: player.id,
            difficulty: chosenDiff,
            category,
            questionCount,
            timeLimitSeconds,
          }),
        });

        if (!res.ok || !res.data || !Array.isArray(res.data.questions)) {
          const msg = res.error || res.data?.error || 'Could not start quiz session.';
          setStartError(msg);
          reportError(msg);
          setStarting(false);
          return;
        }

        arcadeAudio.playSfx('gameStart');
        submittedSessionRef.current = '';
        answersMapRef.current = {};
        setSessionId(res.data.sessionId);
        setQuestions(res.data.questions);
        setCurrentIndex(0);
        setSelectedOption(null);
        setInstantFeedback(null);
        setAnswersMap({});
        setCorrectSoFar(0);
        setWrongSoFar(0);
        setStreak(0);
        setResultPayload(null);
        setSecondsLeft(res.data.timeLimitSeconds || timeLimitSeconds);
        setStage('playing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to reach quiz server.';
        setStartError(msg);
        reportError(msg);
      } finally {
        setStarting(false);
      }
    },
    [category, difficulty, onRequireRegister, player, questionCount, reportError, timeLimitSeconds]
  );

  const currentQuestion = questions[currentIndex] || null;
  const isAnswered = selectedOption !== null && instantFeedback !== null;

  const handleSelectOption = async (optIndex: number) => {
    if (!currentQuestion || !player || selectedOption !== null || checkingAnswer) return;
    setSelectedOption(optIndex);
    setCheckingAnswer(true);

    const nextMap = { ...answersMapRef.current, [currentQuestion.id]: optIndex };
    answersMapRef.current = nextMap;
    setAnswersMap(nextMap);

    try {
      const res = await safeFetchJson<{
        correct: boolean;
        correctIndex: number;
        explanation: string;
        pointsAwarded: number;
        error?: string;
      }>('/api/game/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId: player.id,
          questionId: currentQuestion.id,
          selectedIndex: optIndex,
        }),
      });

      if (res.ok && res.data) {
        setInstantFeedback(res.data);
        if (res.data.correct) {
          setCorrectSoFar((c) => c + 1);
          setStreak((s) => s + 1);
          arcadeAudio.playSfx('correct');
        } else {
          setWrongSoFar((w) => w + 1);
          setStreak(0);
          arcadeAudio.playSfx('wrong');
        }
      }
    } catch (err) {
      reportError(String(err));
    } finally {
      setCheckingAnswer(false);
    }
  };

  const handleSkipOrNext = () => {
    if (!currentQuestion) return;
    arcadeAudio.playSfx('click');

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setInstantFeedback(null);
      return;
    }

    void finishAndSubmitGame();
  };

  /* ============================================================
     STAGE 4: VERIFIED RESULTS & ANIMATED PODIUM
     ============================================================ */
  if (stage === 'results' && resultPayload) {
    return (
      <GamePodiumResults
        result={resultPayload}
        onPlayAgain={() => void startGame(resultPayload.difficulty)}
        onChangeSettings={() => {
          try {
            sessionStorage.removeItem(LAST_SESSION_STORAGE_KEY);
          } catch {
            // ignore
          }
          setResultPayload(null);
          setStage('select');
        }}
        onOpenLeaderboard={onOpenLeaderboard}
      />
    );
  }

  /* ============================================================
     STAGE 3: SUBMITTING / VALIDATING SCORE GATE
     ============================================================ */
  if (stage === 'submitting') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
        <div className="studio-card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white mx-auto flex items-center justify-center animate-pulse">
            <ShieldCheck size={28} />
          </div>
          <h2 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
            Validating Score &amp; Updating Podium...
          </h2>
          <p className="text-sm text-[var(--studio-text-secondary)]">
            Calculating official difficulty points on the server, saving your game record, and syncing live leaderboard standings.
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     STAGE 2: ACTIVE FOCUSED QUIZ GAMEPLAY
     ============================================================ */
  if (stage === 'playing' && currentQuestion) {
    const activeDiff = DIFFICULTY_MAP[difficulty] || DIFFICULTY_MAP.easy;
    const progressPct = Math.round(
      ((currentIndex + (isAnswered ? 1 : 0)) / Math.max(1, questions.length)) * 100
    );
    const livePoints = correctSoFar * activeDiff.marksPerCorrect;
    const optionLetters = ['A', 'B', 'C', 'D'];

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {submitError && (
          <div className="p-4 rounded-xl bg-[#7F1D1D] border-2 border-[#FB7185] text-white text-sm flex flex-wrap items-center justify-between gap-3">
            <span>{submitError}</span>
            <button
              type="button"
              onClick={() => void finishAndSubmitGame()}
              className="studio-btn studio-btn-amber text-xs px-3 py-1.5"
            >
              Retry Score Save
            </button>
          </div>
        )}

        {/* Top Live Status HUD */}
        <div className="studio-card-solid p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setStage('select');
                }}
                className="studio-btn studio-btn-ghost text-xs px-3 py-1.5 min-h-[36px]"
              >
                ← Settings
              </button>
              <div>
                <div className="font-mono-tech text-[11px] font-bold uppercase text-[var(--studio-accent-text)]">
                  {activeDiff.name} (+{activeDiff.marksPerCorrect} pts/Q) · {currentQuestion.topic}
                </div>
                <div className="font-heading font-bold text-sm text-[var(--studio-text)]">
                  Question {currentIndex + 1} of {questions.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono-tech text-xs font-bold tabular-nums">
              <span className="px-2.5 py-1 rounded-lg bg-[#2563EB] text-white">
                {livePoints} PTS
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#059669] text-white">
                ✓ {correctSoFar}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white">
                ✕ {wrongSoFar}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#D97706] text-white flex items-center gap-1">
                <Flame size={13} /> {streak}
              </span>
              {timeLimitSeconds > 0 && (
                <span
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    secondsLeft <= 20
                      ? 'bg-[#DC2626] text-white'
                      : 'studio-well text-[var(--studio-text)]'
                  }`}
                >
                  <Clock size={13} /> {formatClock(secondsLeft)}
                </span>
              )}
            </div>
          </div>

          <div className="h-2.5 rounded-full bg-[var(--studio-surface-2)] border border-[var(--studio-border)] overflow-hidden">
            <div
              className="h-full bg-[#2563EB] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="studio-card p-6 sm:p-8 space-y-6">
          <h2 className="font-heading font-bold text-xl sm:text-2xl text-[var(--studio-text)] leading-snug">
            {currentQuestion.question}
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectChoice = instantFeedback?.correctIndex === idx;

              let btnStyle =
                'bg-[var(--studio-surface-2)] border-[var(--studio-border-strong)] hover:border-[var(--studio-accent-text)] text-[var(--studio-text)]';
              if (isAnswered) {
                if (isCorrectChoice) {
                  btnStyle = 'bg-[#059669] border-[#34D399] text-white shadow-md';
                } else if (isSelected) {
                  btnStyle = 'bg-[#DC2626] border-[#FB7185] text-white';
                } else {
                  btnStyle =
                    'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text-muted)] opacity-65';
                }
              }

              return (
                <button
                  key={`${currentQuestion.id}_${idx}`}
                  type="button"
                  disabled={selectedOption !== null || checkingAnswer}
                  onClick={() => void handleSelectOption(idx)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg font-mono-tech text-xs font-bold flex items-center justify-center shrink-0 border ${
                        isAnswered && (isCorrectChoice || isSelected)
                          ? 'bg-white text-[#090E1A] border-white'
                          : 'bg-[var(--studio-surface)] text-[var(--studio-accent-text)] border-[var(--studio-border-strong)]'
                      }`}
                    >
                      {optionLetters[idx]}
                    </span>
                    <span className="font-sora text-sm sm:text-base font-semibold">{opt}</span>
                  </div>

                  {isAnswered && isCorrectChoice && (
                    <CheckCircle2 size={20} className="text-white shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrectChoice && (
                    <XCircle size={20} className="text-white shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {!isAnswered && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="font-mono-tech text-xs text-[var(--studio-text-muted)]">
                Correct: +{activeDiff.marksPerCorrect} pts · Wrong: 0 · Skip: 0
              </span>
              <button
                type="button"
                onClick={handleSkipOrNext}
                className="studio-btn studio-btn-ghost text-xs px-4 py-2 min-h-[38px]"
              >
                <SkipForward size={14} />
                <span>{currentIndex + 1 < questions.length ? 'Skip (0 pts)' : 'Finish & Submit'}</span>
              </button>
            </div>
          )}

          {/* Instant Explanation Banner */}
          {isAnswered && instantFeedback && (
            <div className="p-4 sm:p-5 rounded-xl studio-well border-2 border-[var(--studio-border-strong)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-bold text-sm sm:text-base text-[var(--studio-text)] flex items-center gap-2">
                  {instantFeedback.correct ? (
                    <>
                      <CheckCircle2 size={18} className="text-[var(--studio-emerald-text)]" /> Correct! +
                      {instantFeedback.pointsAwarded} pts
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} className="text-[#FB7185]" /> Incorrect (0 pts) — Concept Breakdown
                    </>
                  )}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                {instantFeedback.explanation}
              </p>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleSkipOrNext}
                  className="studio-btn studio-btn-primary text-xs sm:text-sm px-5"
                >
                  {currentIndex + 1 < questions.length
                    ? 'Next Question →'
                    : 'Finish Game & Claim Podium →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ============================================================
     STAGE 1: DIFFICULTY CARDS & GAME SETTINGS SELECTION SCREEN
     ============================================================ */
  const activeDifficultyCfg = DIFFICULTY_MAP[difficulty];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Studio Header Banner */}
      <section className="studio-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-emerald-text)] flex items-center gap-2">
            <Sparkles size={14} /> Smart Quiz Arena · 4 Calibrated Difficulty Tiers
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-[var(--studio-text)]">
            Choose Your Challenge &amp; Climb the Podium
          </h1>
          <p className="text-sm sm:text-base text-[var(--studio-text-secondary)]">
            Select from Easy (+10 pts) up to JEE Aspirants (+50 pts), customize your category, question count, and timer, and record verified scores straight to the live Championship Podium.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenLeaderboard();
            }}
            className="studio-btn studio-btn-amber text-xs sm:text-sm"
          >
            <Trophy size={15} />
            <span>View Live Podium</span>
          </button>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenAdvancedStudio();
            }}
            className="studio-btn studio-btn-ghost text-xs sm:text-sm"
          >
            <BookOpen size={15} className="text-[var(--studio-accent-text)]" />
            <span>Full Exam Prep Studio</span>
          </button>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenArena();
            }}
            className="studio-btn studio-btn-purple text-xs sm:text-sm"
          >
            <Car size={15} />
            <span>3D Car &amp; iPhone Arena</span>
          </button>
        </div>
      </section>

      {/* Sign-In Gate Banner when Logged Out */}
      {!player && (
        <section className="p-5 rounded-2xl bg-[var(--studio-surface-2)] border-2 border-[#F59E0B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-heading font-bold text-base sm:text-lg text-[var(--studio-amber-text)] flex items-center gap-2">
              <UserCheck size={18} /> Sign In Required to Save Scores &amp; Compete
            </div>
            <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)]">
              Create or pick your username so every completed game is verified, stored under your ID, and ranked on the real Championship Podium.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onRequireRegister();
            }}
            className="studio-btn studio-btn-amber text-xs sm:text-sm px-5 shrink-0"
          >
            Sign In / Set Username
          </button>
        </section>
      )}

      {startError && (
        <div className="p-4 rounded-xl bg-[#7F1D1D] border-2 border-[#FB7185] text-white text-sm">
          {startError}
        </div>
      )}

      {/* GAME SETTINGS PANEL */}
      <section className="studio-card-solid p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--studio-border)] pb-3">
          <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
            Match Settings
          </h2>
          <span className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
            Selected: {activeDifficultyCfg.shortLabel} (+{activeDifficultyCfg.marksPerCorrect} pts/Q) · {questionCount} Qs ·{' '}
            {timeLimitSeconds === 0 ? 'No Time Limit' : `${Math.round(timeLimitSeconds / 60)} Min Timer`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Category Selector */}
          <div className="space-y-2 md:col-span-1">
            <label
              htmlFor="smart-quiz-category"
              className="block font-mono-tech text-xs font-bold uppercase text-[var(--studio-text-muted)]"
            >
              Game Category
            </label>
            <select
              id="smart-quiz-category"
              value={category}
              onChange={(e) => {
                arcadeAudio.playSfx('click');
                setCategory(e.target.value as GameCategoryId);
              }}
              className="studio-input w-full px-3.5 py-2.5 text-sm font-sora font-semibold"
            >
              {GAME_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Count Selector */}
          <div className="space-y-2">
            <span className="block font-mono-tech text-xs font-bold uppercase text-[var(--studio-text-muted)]">
              Number of Questions
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setQuestionCount(cnt);
                  }}
                  className={`studio-btn text-xs py-2 min-h-[40px] ${
                    questionCount === cnt ? 'studio-btn-primary' : 'studio-btn-ghost'
                  }`}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>
          </div>

          {/* Time Limit Selector */}
          <div className="space-y-2">
            <span className="block font-mono-tech text-xs font-bold uppercase text-[var(--studio-text-muted)]">
              Time Limit
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { sec: 0, label: 'None' },
                { sec: 180, label: '3m' },
                { sec: 300, label: '5m' },
                { sec: 600, label: '10m' },
              ].map((t) => (
                <button
                  key={t.sec}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setTimeLimitSeconds(t.sec);
                  }}
                  className={`studio-btn text-xs py-2 min-h-[40px] ${
                    timeLimitSeconds === t.sec ? 'studio-btn-cyan' : 'studio-btn-ghost'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 DISTINCT DIFFICULTY LEVEL CARDS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
            Select Difficulty Tier
          </h2>
          <span className="font-mono-tech text-xs text-[var(--studio-text-secondary)]">
            Wrong: 0 pts · Unanswered: 0 pts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAME_DIFFICULTY_CONFIGS.map((cfg) => {
            const selected = difficulty === cfg.id;
            return (
              <div
                key={cfg.id}
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setDifficulty(cfg.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDifficulty(cfg.id);
                  }
                }}
                className={`studio-card p-5 sm:p-6 flex flex-col justify-between gap-4 cursor-pointer transition-all ${
                  selected
                    ? 'border-2 ring-2 ring-[var(--studio-accent-text)]'
                    : 'border border-[var(--studio-border-strong)] hover:border-[var(--studio-accent-text)]'
                }`}
                style={selected ? { borderColor: cfg.accentColor } : undefined}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="font-mono-tech text-xs font-bold uppercase tracking-wider"
                        style={{ color: cfg.accentColor }}
                      >
                        Tier {cfg.levelNumber}
                      </div>
                      <h3 className="font-heading font-bold text-xl text-[var(--studio-text)] mt-0.5">
                        {cfg.name}
                      </h3>
                    </div>

                    <div
                      className="px-3 py-1.5 rounded-lg text-white font-heading font-bold text-sm shrink-0 shadow-sm"
                      style={{ backgroundColor: cfg.accentColor }}
                    >
                      +{cfg.marksPerCorrect} pts / Q
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                    {cfg.description}
                  </p>

                  <div className="p-3 rounded-lg studio-well border border-[var(--studio-border)] text-xs text-[var(--studio-text)] font-mono-tech">
                    {cfg.exampleStyle}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--studio-border)] flex items-center justify-between gap-3">
                  <span className="font-mono-tech text-xs text-[var(--studio-text-muted)]">
                    Max {questionCount * cfg.marksPerCorrect} pts ({questionCount} Qs)
                  </span>

                  <button
                    type="button"
                    disabled={starting}
                    onClick={(e) => {
                      e.stopPropagation();
                      void startGame(cfg.id);
                    }}
                    className="studio-btn studio-btn-primary text-xs px-4 py-2 min-h-[38px]"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>{starting && selected ? 'Starting...' : `Start ${cfg.shortLabel}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUICK TOPIC CARDS (SYNC CATEGORY & PLAY) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
            Or Pick a Subject Focus ({activeDifficultyCfg.shortLabel} · +{activeDifficultyCfg.marksPerCorrect} pts/Q)
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GAME_CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat.id);
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setCategory(cat.id);
                }}
                className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-3 ${
                  active
                    ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                    : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)] hover:border-[var(--studio-accent-text)]'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <div className="min-w-0">
                  <div className="font-sora font-bold text-xs sm:text-sm truncate">{cat.shortName}</div>
                  <div className={`text-[11px] truncate ${active ? 'text-white/85' : 'text-[var(--studio-text-muted)]'}`}>
                    {cat.id === 'all' ? 'Full STEM Mix' : 'Focused'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            disabled={starting}
            onClick={() => void startGame(difficulty)}
            className="studio-btn studio-btn-emerald text-sm sm:text-base px-8 py-3.5 shadow-lg"
          >
            <Play size={18} fill="currentColor" />
            <span>
              {starting
                ? 'Creating Verified Session...'
                : player
                  ? `Start Game — ${activeDifficultyCfg.shortLabel} (${questionCount} Qs)`
                  : 'Sign In & Start Game'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
