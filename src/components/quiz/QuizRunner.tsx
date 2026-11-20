import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { arcadeAudio } from '../../audio/arcadeAudio.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import {
  speakQuestion,
  startPushToTalkListener,
  stopSpeaking,
  type VoiceCommandType,
} from '../../utils/quizVoice.ts';
import {
  getRecentlySeenQuestionIds,
  readOfflineCache,
  recordQuizHistory,
  syncProgressToJeejarvisKey,
  updateOfflineCache,
  type ActiveQuizDraft,
} from '../../utils/storageMigration.ts';
import { getModeScoringRules } from '../../../shared/quizPipeline.ts';
import type {
  ExamAnswerItem,
  ExamDifficulty,
  ExamResultSummary,
  ExamSettings,
  ExamUserAnswer,
  PublicExamQuestion,
  SmartExplanation,
} from '../../../shared/types.ts';
import {
  PixelIcon,
  PixelIllustration,
  PixelLoader,
  PixelMascot,
  type MascotMood,
} from '../pixel/PixelArtAssets.tsx';
import { QuestionRenderer } from './QuestionRenderer.tsx';
import { QuizOrb, type QuizOrbState } from './QuizOrb.tsx';
import { SmartExplanationCard } from './SmartExplanationCard.tsx';
import { QuizResultsView } from './QuizResultsView.tsx';

interface QuizRunnerProps {
  initialSettings: ExamSettings;
  customQuestionIds?: string[];
  initialDraft?: ActiveQuizDraft | null;
  onExit: () => void;
  onPlayAgain: () => void;
  onRetryWrongIds: (wrongIds: string[]) => void;
  onPracticeSimilar: (preset: Partial<ExamSettings>) => void;
  onViewAnalytics: () => void;
}

interface ImmediateCheck {
  correct: boolean;
  correctAnswer: number | number[] | string;
  explanation: SmartExplanation;
  source?: string;
  year?: number | null;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  initialSettings,
  customQuestionIds,
  initialDraft,
  onExit,
  onPlayAgain,
  onRetryWrongIds,
  onPracticeSimilar,
  onViewAnalytics,
}) => {
  const { examUserId, player, bookmarkedIds, toggleBookmark, setMusicMode, isOnline, reportError } =
    useArcade();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<PublicExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamUserAnswer>>({});
  const [markedReview, setMarkedReview] = useState<Record<string, boolean>>({});
  const [timeSpentByQ, setTimeSpentByQ] = useState<Record<string, number>>({});
  const [checkedFeedback, setCheckedFeedback] = useState<Record<string, ImmediateCheck>>({});

  const [smartBoardMode, setSmartBoardMode] = useState<boolean>(
    Boolean(initialSettings.smartBoardMode)
  );
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const [adaptiveDiff, setAdaptiveDiff] = useState<ExamDifficulty>('Medium');
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [mascotMood, setMascotMood] = useState<MascotMood>('thinking');
  const [timeLeft, setTimeLeft] = useState(initialSettings.timeLimitMinutes * 60);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const [antiCheatNotice, setAntiCheatNotice] = useState<string | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [drumRollRevealing, setDrumRollRevealing] = useState(false);
  const [pendingResult, setPendingResult] = useState<ExamResultSummary | null>(null);
  const [result, setResult] = useState<ExamResultSummary | null>(null);

  const qEnteredAtRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const stopVoiceRef = useRef<(() => void) | null>(null);

  const isExamMode =
    initialSettings.mode === 'mock' ||
    initialSettings.mode === 'timed' ||
    initialSettings.mode === 'jee';
  const isImmediateMode = !isExamMode;
  const scoringRule = getModeScoringRules(initialSettings.mode, initialSettings.negativeMarking);

  // Emotion-varying background music driven by mode, timer urgency, hearts & combo streaks
  useEffect(() => {
    if (loading || result || drumRollRevealing || questions.length === 0) return;

    const urgentTimer = timeLeft <= 30;
    const criticalSurvival = initialSettings.mode === 'survival' && lives <= 1;

    if (urgentTimer || criticalSurvival) {
      setMusicMode('tension');
    } else if (streak >= 2) {
      setMusicMode('excitement');
    } else if (initialSettings.mode === 'practice' || initialSettings.mode === 'revision') {
      setMusicMode('focus');
    } else {
      setMusicMode('gameplay');
    }
  }, [
    drumRollRevealing,
    initialSettings.mode,
    lives,
    loading,
    questions.length,
    result,
    setMusicMode,
    streak,
    timeLeft,
  ]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      stopVoiceRef.current?.();
      stopSpeaking();
    };
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    submittedRef.current = false;
    setResult(null);
    setPendingResult(null);
    setDrumRollRevealing(false);
    setCheckedFeedback({});
    setAnswers({});
    setMarkedReview({});
    setTimeSpentByQ({});
    setLives(3);
    setStreak(0);
    setMascotMood('thinking');
    setTabSwitches(0);
    setFullscreenExits(0);
    setAntiCheatNotice(null);

    try {
      const seenIds =
        initialSettings.mode === 'revision' ||
        initialSettings.mode === 'weak' ||
        customQuestionIds?.length
          ? []
          : getRecentlySeenQuestionIds(50);

      if (!isOnline) {
        const cached = readOfflineCache().questions;
        if (cached.length > 0) {
          const subset = cached.slice(0, Math.min(initialSettings.questionCount || 10, cached.length));
          setSessionId(`offline_${Date.now()}`);
          setQuestions(subset);
          setTimeLeft(initialSettings.timeLimitMinutes * 60);
          setCurrentIndex(0);
          qEnteredAtRef.current = Date.now();
          setLoading(false);
          return;
        }
      }

      const res = await safeFetchJson<{
        sessionId: string;
        questions: PublicExamQuestion[];
        timeLimitSeconds?: number;
        adaptiveState?: { currentDifficulty?: ExamDifficulty };
        error?: string;
      }>('/api/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: examUserId,
          displayName: player?.name,
          ...initialSettings,
          excludeQuestionIds: seenIds,
          questionIds: customQuestionIds,
        }),
      });
      if (!res.ok || !res.data || !Array.isArray(res.data.questions)) {
        throw new Error(res.error || 'Could not start quiz session.');
      }

      const data = res.data;
      soundManager.playGameStart();
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setTimeLeft(data.timeLimitSeconds || initialSettings.timeLimitMinutes * 60);
      setAdaptiveDiff(data.adaptiveState?.currentDifficulty || 'Medium');
      setCurrentIndex(0);
      qEnteredAtRef.current = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start quiz.';
      setErrorMsg(msg);
      reportError(msg);
    } finally {
      setLoading(false);
    }
  }, [customQuestionIds, examUserId, initialSettings, isOnline, player?.name, reportError]);

  useEffect(() => {
    if (initialDraft && initialDraft.questions?.length > 0 && initialDraft.sessionId) {
      setSessionId(initialDraft.sessionId);
      setQuestions(initialDraft.questions);
      setCurrentIndex(Math.min(initialDraft.currentIndex || 0, initialDraft.questions.length - 1));
      setAnswers(initialDraft.answers || {});
      const revMap: Record<string, boolean> = {};
      for (const id of initialDraft.markedReview || []) revMap[id] = true;
      setMarkedReview(revMap);
      setTimeLeft(Math.max(30, initialDraft.timeLeftSeconds || 300));
      setSmartBoardMode(Boolean(initialDraft.settings?.smartBoardMode));
      qEnteredAtRef.current = Date.now();
      setLoading(false);
      return;
    }
    void startSession();
  }, [initialDraft, startSession]);

  useEffect(() => {
    if (!sessionId || result || questions.length === 0) return;
    syncProgressToJeejarvisKey({
      mode: initialSettings.mode,
      settings: { ...initialSettings, smartBoardMode },
      sessionId,
      questions,
      currentIndex,
      answers,
      markedReview: Object.keys(markedReview).filter((k) => markedReview[k]),
      timeLeftSeconds: timeLeft,
      savedAt: new Date().toISOString(),
    });
  }, [
    answers,
    currentIndex,
    initialSettings,
    markedReview,
    questions,
    result,
    sessionId,
    smartBoardMode,
    timeLeft,
  ]);

  const recordQuestionTime = useCallback(() => {
    const q = questions[currentIndex];
    if (!q) return timeSpentByQ;
    const delta = Math.max(500, Date.now() - qEnteredAtRef.current);
    qEnteredAtRef.current = Date.now();
    const updated = { ...timeSpentByQ, [q.id]: (timeSpentByQ[q.id] || 0) + delta };
    setTimeSpentByQ(updated);
    return updated;
  }, [currentIndex, questions, timeSpentByQ]);

  const submitQuiz = useCallback(
    async (finalTimes?: Record<string, number>) => {
      if (submittedRef.current || questions.length === 0) return;
      submittedRef.current = true;
      setSubmitting(true);
      setConfirmSubmitOpen(false);
      stopVoiceRef.current?.();
      stopSpeaking();

      const timingMap = finalTimes || recordQuestionTime();
      const payloadAnswers: ExamAnswerItem[] = questions.map((q) => ({
        questionId: q.id,
        userAnswer: answers[q.id] ?? null,
        timeMs: timingMap[q.id] || 8000,
        markedForReview: Boolean(markedReview[q.id]),
      }));

      try {
        const res = await safeFetchJson<ExamResultSummary & { error?: string }>('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: examUserId,
            displayName: player?.name,
            mode: initialSettings.mode,
            categoryId: initialSettings.categoryId,
            subject: initialSettings.subject,
            negativeMarking: initialSettings.negativeMarking,
            questionIds: questions.map((q) => q.id),
            answers: payloadAnswers,
            antiCheat: { tabSwitches, fullscreenExits },
          }),
        });
        if (!res.ok || !res.data) {
          throw new Error(res.error || 'Submission failed.');
        }

        const data = res.data;
        syncProgressToJeejarvisKey(null);
        recordQuizHistory(data, initialSettings.subject, initialSettings.categoryId);
        const cache = readOfflineCache();
        updateOfflineCache({
          historyResults: { ...cache.historyResults, [data.attemptId]: data },
        });

        // Dramatic Drum Roll suspense reveal before displaying results!
        setPendingResult(data);
        setDrumRollRevealing(true);
        soundManager.playDrumRoll();
        revealTimerRef.current = window.setTimeout(() => {
          setDrumRollRevealing(false);
          setResult(data);
        }, 1100);
      } catch (err) {
        submittedRef.current = false;
        const msg = err instanceof Error ? err.message : 'Unable to submit quiz.';
        setErrorMsg(msg);
        reportError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      answers,
      examUserId,
      fullscreenExits,
      initialSettings.categoryId,
      initialSettings.mode,
      initialSettings.negativeMarking,
      initialSettings.subject,
      markedReview,
      player?.name,
      questions,
      recordQuestionTime,
      reportError,
      sessionId,
      tabSwitches,
    ]
  );

  // Countdown Timer
  useEffect(() => {
    if (loading || result || drumRollRevealing || questions.length === 0) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          void submitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [drumRollRevealing, loading, questions.length, result, submitQuiz]);

  // Mock / JEE Exam Focus Guard
  useEffect(() => {
    if (loading || result || !isExamMode) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onVisibility = () => {
      if (document.hidden) {
        setTabSwitches((c) => {
          const next = c + 1;
          setAntiCheatNotice(`Tab switch detected (${next}). Stay inside the quiz window.`);
          return next;
        });
      }
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenExits((c) => c + 1);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [isExamMode, loading, result]);

  const currentQ = questions[currentIndex];
  const currentCheck = currentQ ? checkedFeedback[currentQ.id] : undefined;

  const hasCurrentAnswer = Boolean(
    currentQ &&
      answers[currentQ.id] !== undefined &&
      answers[currentQ.id] !== null &&
      answers[currentQ.id] !== '' &&
      (!Array.isArray(answers[currentQ.id]) || (answers[currentQ.id] as number[]).length > 0)
  );

  const handleCheckAnswer = useCallback(async () => {
    if (!currentQ || !isImmediateMode || currentCheck || !hasCurrentAnswer) return;
    const userAns = answers[currentQ.id] ?? null;

    const updatedTimes = recordQuestionTime();
    const spentOnQ = updatedTimes[currentQ.id] || 8000;
    try {
      const res = await safeFetchJson<{
        correct: boolean;
        correctAnswer: number | number[] | string;
        explanation: SmartExplanation;
        source?: string;
        year?: number | null;
        adaptiveState?: { currentDifficulty?: ExamDifficulty };
        error?: string;
      }>('/api/exam/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: currentQ.id,
          userAnswer: userAns,
        }),
      });
      if (!res.ok || !res.data) {
        reportError(res.error || 'Answer check failed');
        return;
      }

      const data = res.data;
      setCheckedFeedback((prev) => ({
        ...prev,
        [currentQ.id]: {
          correct: data.correct,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          source: data.source || currentQ.source,
          year: data.year ?? currentQ.year,
        },
      }));

      if (data.adaptiveState?.currentDifficulty) {
        setAdaptiveDiff(data.adaptiveState.currentDifficulty);
      }

      if (data.correct) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setMascotMood(nextStreak >= 2 ? 'excited' : 'happy');
        if (nextStreak >= 3) {
          soundManager.playSfx('wow');
        } else if (nextStreak === 2) {
          soundManager.playCombo(nextStreak);
        } else {
          soundManager.playCorrect();
        }
      } else {
        setStreak(0);
        setMascotMood('sad');
        if (initialSettings.mode === 'survival') {
          soundManager.playSfx('vineBoom');
          const remaining = lives - 1;
          setLives(remaining);
          if (remaining <= 0) {
            void submitQuiz(updatedTimes);
          }
        } else if (spentOnQ < 5500) {
          soundManager.playSfx('bonk');
        } else {
          soundManager.playSfx('oof');
        }
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [
    answers,
    currentCheck,
    currentQ,
    hasCurrentAnswer,
    initialSettings.mode,
    isImmediateMode,
    lives,
    recordQuestionTime,
    reportError,
    sessionId,
    streak,
    submitQuiz,
  ]);

  const goToQuestion = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0 || nextIdx >= questions.length) return;
      arcadeAudio.playSfx('click');
      recordQuestionTime();
      setMascotMood(streak >= 2 ? 'happy' : 'thinking');
      setCurrentIndex(nextIdx);
      setPaletteOpen(false);
    },
    [questions.length, recordQuestionTime, streak]
  );

  // Voice Push-to-Talk Handler
  const handleVoiceCommand = useCallback(
    (cmd: VoiceCommandType, transcript: string) => {
      if (!currentQ) return;
      setVoiceNotice(`Voice: "${transcript}"`);
      window.setTimeout(() => setVoiceNotice(null), 3000);

      if (cmd.type === 'select_option' && !currentCheck) {
        if (cmd.index >= 0 && cmd.index < currentQ.options.length) {
          arcadeAudio.playSfx('click');
          if (currentQ.questionType === 'multiple') {
            const prev = Array.isArray(answers[currentQ.id]) ? (answers[currentQ.id] as number[]) : [];
            const next = prev.includes(cmd.index)
              ? prev.filter((i) => i !== cmd.index)
              : [...prev, cmd.index].sort((a, b) => a - b);
            setAnswers((p) => ({ ...p, [currentQ.id]: next }));
          } else {
            setAnswers((p) => ({ ...p, [currentQ.id]: cmd.index }));
          }
        }
      } else if (cmd.type === 'explain') {
        void handleCheckAnswer();
      } else if (cmd.type === 'repeat') {
        speakQuestion(currentQ);
      } else if (cmd.type === 'next' || cmd.type === 'skip') {
        if (currentIndex + 1 < questions.length) {
          goToQuestion(currentIndex + 1);
        }
      } else if (cmd.type === 'submit') {
        setConfirmSubmitOpen(true);
      }
    },
    [answers, currentCheck, currentIndex, currentQ, goToQuestion, handleCheckAnswer, questions.length]
  );

  const toggleVoiceListener = () => {
    if (voiceListening) {
      stopVoiceRef.current?.();
      stopVoiceRef.current = null;
      return;
    }
    stopVoiceRef.current = startPushToTalkListener({
      onStateChange: (listening) => setVoiceListening(listening),
      onCommand: handleVoiceCommand,
      onUnrecognized: (txt) => {
        setVoiceNotice(`Did not recognize "${txt}". Try: Option A, Next, Repeat, Explain.`);
        window.setTimeout(() => setVoiceNotice(null), 3200);
      },
      onError: (reason) => {
        setVoiceNotice(reason);
        window.setTimeout(() => setVoiceNotice(null), 3200);
      },
    });
  };

  // Keyboard Navigation (A/B/C/D, 1-4, Enter, ArrowLeft/ArrowRight)
  useEffect(() => {
    if (loading || result || drumRollRevealing || confirmSubmitOpen || !currentQ) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.key === 'ArrowRight' && currentIndex + 1 < questions.length) {
        goToQuestion(currentIndex + 1);
        return;
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        goToQuestion(currentIndex - 1);
        return;
      }

      if (!currentCheck && currentQ.options.length > 0 && currentQ.questionType !== 'match') {
        const map: Record<string, number> = { a: 0, '1': 0, b: 1, '2': 1, c: 2, '3': 2, d: 3, '4': 3 };
        if (key in map && map[key] < currentQ.options.length) {
          const idx = map[key];
          arcadeAudio.playSfx('click');
          if (currentQ.questionType === 'multiple') {
            const prev = Array.isArray(answers[currentQ.id]) ? (answers[currentQ.id] as number[]) : [];
            const next = prev.includes(idx)
              ? prev.filter((i) => i !== idx)
              : [...prev, idx].sort((a, b) => a - b);
            setAnswers((p) => ({ ...p, [currentQ.id]: next }));
          } else {
            setAnswers((p) => ({ ...p, [currentQ.id]: idx }));
          }
          return;
        }
      }

      if (e.key === 'Enter') {
        if (isImmediateMode && !currentCheck && hasCurrentAnswer) {
          e.preventDefault();
          void handleCheckAnswer();
        } else if (currentIndex + 1 < questions.length && (currentCheck || isExamMode)) {
          e.preventDefault();
          goToQuestion(currentIndex + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    answers,
    confirmSubmitOpen,
    currentCheck,
    currentIndex,
    currentQ,
    drumRollRevealing,
    goToQuestion,
    handleCheckAnswer,
    hasCurrentAnswer,
    isExamMode,
    isImmediateMode,
    loading,
    questions.length,
    result,
  ]);

  if (result) {
    return (
      <QuizResultsView
        result={result}
        onPlayAgain={onPlayAgain}
        onRetryWrong={(wrongIds) => onRetryWrongIds(wrongIds)}
        onPracticeSimilar={onPracticeSimilar}
        onBackToStudio={onExit}
        onViewAnalytics={onViewAnalytics}
      />
    );
  }

  if (drumRollRevealing && pendingResult) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="exam-card p-8 text-center space-y-5">
          <div className="animate-drumroll inline-block">
            <PixelIllustration name="trophy" size={76} className="mx-auto" />
          </div>
          <h2 className="font-pixel text-base sm:text-lg text-[var(--voxel-gold)] tracking-wider">
            DRUM ROLL...
          </h2>
          <p className="font-display-pixel text-xs sm:text-sm text-[var(--exam-text-secondary)]">
            Calculating your engineering score!
          </p>
          <button
            type="button"
            onClick={() => {
              if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
              setDrumRollRevealing(false);
              setResult(pendingResult);
            }}
            className="font-display-pixel text-xs text-[var(--exam-accent)] hover:underline cursor-pointer"
          >
            Reveal Now →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="exam-card p-8 text-center">
          <PixelLoader label="BUILDING QUIZ BLOCKS..." />
        </div>
      </div>
    );
  }

  if (errorMsg || !currentQ) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="exam-card p-6 sm:p-8 text-center space-y-4">
          <PixelIllustration name="oops" size={56} className="mx-auto" />
          <h2 className="font-pixel text-sm text-[var(--exam-text)]">OOPS!</h2>
          <p className="text-sm text-[var(--exam-text-secondary)]">
            {errorMsg || 'Something went wrong loading questions for this mode.'}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void startSession()}
              className="exam-btn exam-btn-primary text-sm"
            >
              TRY AGAIN
            </button>
            <button type="button" onClick={onExit} className="exam-btn exam-btn-secondary text-sm">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (a === null || a === undefined || a === '') return false;
    if (Array.isArray(a)) return a.length > 0 && a.every((v) => v >= 0);
    return true;
  }).length;

  const isLast = currentIndex + 1 >= questions.length;
  const orbState: QuizOrbState = currentCheck
    ? currentCheck.correct
      ? 'correct'
      : 'incorrect'
    : hasCurrentAnswer
      ? 'selected'
      : 'question';

  return (
    <div
      className={`${
        smartBoardMode ? 'max-w-5xl' : isExamMode ? 'max-w-6xl' : 'max-w-3xl'
      } mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-24 sm:pb-10`}
    >
      {/* Compact Pixel Quiz HUD Bar */}
      <div className="exam-card p-3.5 sm:p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onExit();
              }}
              aria-label="Exit quiz"
              className="exam-btn exam-btn-secondary px-3 py-1.5 min-h-[42px] text-xs"
            >
              ← EXIT
            </button>
            <PixelMascot mood={timeLeft <= 30 ? 'boss' : mascotMood} size={36} />
            <div>
              <div className="font-display-pixel text-xs font-bold text-[var(--exam-accent)] uppercase">
                {initialSettings.mode === 'jee'
                  ? 'JEE PRACTICE'
                  : initialSettings.mode === 'career_fair'
                    ? 'CAREER FAIR'
                    : initialSettings.mode === 'mock'
                      ? 'MOCK EXAM'
                      : `${initialSettings.mode.replace('_', ' ')} QUIZ`}
                {streak >= 2
                  ? ` · ${streak}x COMBO!`
                  : initialSettings.difficulty === 'Adaptive'
                    ? ` · ${adaptiveDiff}`
                    : ''}
              </div>
              <div className="font-code text-xs sm:text-sm font-bold text-[var(--exam-text)] tabular-nums">
                Question {currentIndex + 1} / {questions.length} · {scoringRule.label}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <QuizOrb state={orbState} compact />

            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setSmartBoardMode((v) => !v);
              }}
              title="Toggle Smart Board large-screen touch mode"
              className={`min-h-[40px] px-2.5 py-1.5 border-2 font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer ${
                smartBoardMode
                  ? 'bg-[var(--exam-accent-soft)] border-[var(--exam-accent)] text-[var(--exam-accent)]'
                  : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-muted)]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{smartBoardMode ? 'BOARD ON' : 'BOARD'}</span>
            </button>

            {initialSettings.mode === 'survival' && (
              <div className="flex items-center gap-1 text-[var(--exam-danger)] px-2 py-1 border-2 border-[var(--exam-border)] bg-[var(--exam-surface-alt)]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < lives ? '' : 'opacity-25'}>
                    <PixelIcon name="heart" size={14} />
                  </span>
                ))}
              </div>
            )}

            <div
              className={`px-3 py-1.5 min-h-[40px] border-2 font-code text-xs sm:text-sm font-bold flex items-center gap-1.5 tabular-nums ${
                timeLeft <= 30
                  ? 'bg-[var(--exam-danger-soft)] border-[var(--exam-danger)] text-[var(--exam-danger)] animate-pixel-flash'
                  : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text)]'
              }`}
            >
              <PixelIcon name="timer" size={14} /> {formatTimer(timeLeft)}
            </div>

            {isExamMode && (
              <button
                type="button"
                onClick={() => setPaletteOpen((v) => !v)}
                className="lg:hidden exam-btn exam-btn-secondary px-3 py-1.5 text-xs min-h-[40px]"
              >
                Palette
              </button>
            )}

            {(isExamMode || answeredCount > 0) && (
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                disabled={submitting}
                className="exam-btn exam-btn-gold px-3.5 py-1.5 text-xs min-h-[40px]"
              >
                {submitting ? '...' : 'FINISH'}
              </button>
            )}
          </div>
        </div>

        {/* Segmented Block Progress Bar */}
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={questions.length}
        >
          {questions.map((q, idx) => {
            const isPastOrCurrent = idx <= currentIndex;
            const hasAns =
              answers[q.id] !== undefined &&
              answers[q.id] !== null &&
              answers[q.id] !== '' &&
              (!Array.isArray(answers[q.id]) || (answers[q.id] as number[]).length > 0);
            const checked = checkedFeedback[q.id];

            let bg = 'bg-[var(--exam-surface-alt)]';
            if (checked) {
              bg = checked.correct ? 'bg-[var(--exam-success)]' : 'bg-[var(--exam-danger)]';
            } else if (idx === currentIndex) {
              bg = 'bg-[var(--voxel-gold)]';
            } else if (hasAns || isPastOrCurrent) {
              bg = 'bg-[var(--voxel-green)]';
            }

            return (
              <div
                key={q.id}
                className={`h-2.5 flex-1 border border-[#0B0F1A] transition-colors ${bg}`}
              />
            );
          })}
        </div>
      </div>

      {voiceNotice && (
        <div className="mb-4 px-4 py-2 border-2 bg-[var(--exam-accent-soft)] border-[var(--exam-accent)] text-xs font-code text-[var(--exam-text)]">
          {voiceNotice}
        </div>
      )}

      {antiCheatNotice && isExamMode && (
        <div className="mb-4 px-4 py-2.5 border-2 bg-[var(--exam-warning-soft)] border-[var(--exam-warning)] text-xs sm:text-sm flex items-center justify-between gap-2">
          <span className="font-medium text-[var(--exam-text)]">{antiCheatNotice}</span>
          <button
            type="button"
            onClick={() => setAntiCheatNotice(null)}
            className="text-[var(--exam-text-muted)] cursor-pointer"
          >
            <PixelIcon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Main Question Workspace */}
      <div className={`grid gap-6 ${isExamMode ? 'lg:grid-cols-[1fr_260px]' : ''}`}>
        <div className="space-y-4">
          <QuestionRenderer
            question={currentQ}
            userAnswer={answers[currentQ.id] ?? null}
            onChangeAnswer={(val) => {
              if (currentCheck) return;
              setAnswers((prev) => ({ ...prev, [currentQ.id]: val }));
            }}
            disabled={Boolean(currentCheck)}
            revealCorrectAnswer={currentCheck ? currentCheck.correctAnswer : null}
            isBookmarked={bookmarkedIds.includes(currentQ.id)}
            onToggleBookmark={() => void toggleBookmark(currentQ.id)}
            smartBoardMode={smartBoardMode}
            voiceListening={voiceListening}
            onToggleVoiceCommand={toggleVoiceListener}
          />

          {currentCheck && (
            <SmartExplanationCard
              isCorrect={currentCheck.correct}
              questionType={currentQ.questionType}
              options={currentQ.options}
              matchRight={currentQ.matchPairs?.right}
              userAnswer={answers[currentQ.id] ?? null}
              correctAnswer={currentCheck.correctAnswer}
              explanation={currentCheck.explanation}
              source={currentCheck.source}
              year={currentCheck.year}
              defaultExpanded
            />
          )}

          {/* Clean Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  className="exam-btn exam-btn-secondary text-xs sm:text-sm px-4 min-h-[48px]"
                >
                  ← Prev
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setMarkedReview((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
                }
                className={`font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer px-3 min-h-[48px] ${
                  markedReview[currentQ.id]
                    ? 'text-[var(--exam-warning)]'
                    : 'text-[var(--exam-text-muted)] hover:text-[var(--exam-text)]'
                }`}
              >
                <PixelIcon name="flag" size={13} />
                <span>{markedReview[currentQ.id] ? 'Marked' : 'Mark'}</span>
              </button>

              {isImmediateMode && !currentCheck && !isLast && (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  className="font-display-pixel text-xs text-[var(--exam-text-muted)] hover:text-[var(--exam-text)] px-3 min-h-[48px] cursor-pointer"
                >
                  Skip →
                </button>
              )}
            </div>

            <div>
              {isImmediateMode && !currentCheck ? (
                <button
                  type="button"
                  onClick={() => void handleCheckAnswer()}
                  disabled={!hasCurrentAnswer}
                  className="exam-btn exam-btn-primary text-sm px-7 min-h-[50px]"
                >
                  CHECK ANSWER
                </button>
              ) : !isLast ? (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  className="exam-btn exam-btn-primary text-sm px-7 min-h-[50px]"
                >
                  NEXT →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitQuiz()}
                  disabled={submitting}
                  className="exam-btn exam-btn-primary text-sm px-7 min-h-[50px]"
                >
                  {submitting ? 'GRADING...' : 'COMPLETE QUIZ'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mock / JEE Exam Question Palette */}
        {isExamMode && (
          <aside className={`${paletteOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="exam-card p-4 sticky top-20">
              <div className="font-display-pixel text-xs text-[var(--exam-text-muted)] mb-3">
                QUESTION PALETTE
              </div>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const isAns =
                    ans !== undefined &&
                    ans !== null &&
                    ans !== '' &&
                    (!Array.isArray(ans) || (ans.length > 0 && ans.every((v) => v >= 0)));
                  const isRev = Boolean(markedReview[q.id]);
                  const isCurr = idx === currentIndex;

                  let cls =
                    'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-secondary)]';
                  if (isRev) {
                    cls =
                      'bg-[var(--exam-warning-soft)] border-[var(--exam-warning)] text-[var(--exam-warning)]';
                  } else if (isAns) {
                    cls =
                      'bg-[var(--exam-success-soft)] border-[var(--exam-success)] text-[var(--exam-success)]';
                  }
                  if (isCurr) {
                    cls += ' ring-2 ring-[var(--voxel-gold)]';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(idx)}
                      className={`h-11 border-2 font-code text-xs font-bold cursor-pointer ${cls}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1 text-xs text-[var(--exam-text-muted)] border-t-2 border-[var(--exam-border)] pt-3">
                <div>Green = Done · Gold = Marked</div>
                <div className="text-[var(--exam-warning)] font-medium">
                  Marking: {scoringRule.label}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {confirmSubmitOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setConfirmSubmitOpen(false)}
        >
          <div
            className="exam-card max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="font-pixel text-sm text-[var(--exam-text)]">FINISH QUIZ?</h3>
            <p className="text-sm text-[var(--exam-text-secondary)]">
              You have answered <strong>{answeredCount}</strong> of{' '}
              <strong>{questions.length}</strong> questions.
              {questions.length - answeredCount > 0
                ? ` ${questions.length - answeredCount} question(s) are unanswered.`
                : ''}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="exam-btn exam-btn-secondary flex-1 text-xs min-h-[46px]"
              >
                Keep Playing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitQuiz()}
                className="exam-btn exam-btn-primary flex-1 text-xs min-h-[46px]"
              >
                {submitting ? 'Grading...' : 'Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
