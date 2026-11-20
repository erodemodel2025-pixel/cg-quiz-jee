import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, Search, History } from 'lucide-react';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { EXAM_CATEGORIES } from '../../shared/categories.ts';
import { getModeScoringRules } from '../../shared/quizPipeline.ts';
import type {
  DailyExamStatus,
  ExamDifficulty,
  ExamMode,
  ExamResultSummary,
  ExamSettings,
  QuestionType,
} from '../../shared/types.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import { loadQuizHistory, type QuizHistoryEntry } from '../utils/storageMigration.ts';
import { PixelIcon, PixelMascot, type PixelIconName } from '../components/pixel/PixelArtAssets.tsx';
import { QuizResultsView } from '../components/quiz/QuizResultsView.tsx';

interface QuizStudioPageProps {
  initialPreset?: Partial<ExamSettings> | null;
  onStartQuiz: (settings: ExamSettings) => void;
  onOpenArcade: () => void;
}

const QUIZ_MODES: Array<{
  id: ExamMode;
  title: string;
  desc: string;
  icon: PixelIconName;
}> = [
  { id: 'career_fair', title: 'Career Fair', desc: '10 accessible Qs · Engineering Profile', icon: 'engineering' },
  { id: 'quick', title: 'Quick Quiz', desc: '10 questions · Instant WHY feedback', icon: 'quiz' },
  { id: 'standard', title: 'Standard Quiz', desc: '20 Qs · Balanced 30/45/25 mix', icon: 'book' },
  { id: 'challenge', title: 'Challenge', desc: '20 Qs · 60% Hard/Expert gauntlet', icon: 'flame' },
  { id: 'jee', title: 'JEE Practice', desc: '20 Qs · +4 / -1 / 0 exam scoring', icon: 'trophy' },
  { id: 'mixed', title: 'Mixed All', desc: '20 Qs · Balanced cross-topic spread', icon: 'technology' },
  { id: 'adaptive', title: 'Adaptive', desc: 'Dynamic difficulty shifts with streak', icon: 'target' },
  { id: 'weak', title: 'Weak Topics', desc: 'Targets areas from past mistakes', icon: 'heart' },
  { id: 'revision', title: 'Mistake Variants', desc: 'Related concepts for missed items', icon: 'refresh' },
  { id: 'daily', title: 'Daily Quest', desc: '1 engineering quest a day', icon: 'score' },
  { id: 'survival', title: 'Survival', desc: '3 hearts · Don’t miss', icon: 'flag' },
  { id: 'mock', title: 'Mock Exam', desc: 'Full exam palette · +4 / -1', icon: 'timer' },
];

type GroupTab = 'All' | 'Careers & Pathways' | 'JEE & Admissions' | 'Branches' | 'Core Subjects';

const GROUP_TABS: GroupTab[] = [
  'All',
  'Careers & Pathways',
  'JEE & Admissions',
  'Branches',
  'Core Subjects',
];

export const QuizStudioPage: React.FC<QuizStudioPageProps> = ({
  initialPreset,
  onStartQuiz,
  onOpenArcade,
}) => {
  const { examUserId, setMusicMode } = useArcade();

  const [mode, setMode] = useState<ExamMode>(initialPreset?.mode || 'quick');
  const [categoryId, setCategoryId] = useState<string>(initialPreset?.categoryId || 'all');
  const [subject, setSubject] = useState<string>(initialPreset?.subject || 'all');
  const [chapter, setChapter] = useState<string>(initialPreset?.chapter || 'all');
  const [difficulty, setDifficulty] = useState<ExamDifficulty | 'Adaptive' | 'Mixed'>(
    initialPreset?.difficulty || 'Adaptive'
  );
  const [questionType, setQuestionType] = useState<QuestionType | 'All'>(
    initialPreset?.questionType || 'All'
  );
  const [questionCount, setQuestionCount] = useState<number>(initialPreset?.questionCount || 10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(
    initialPreset?.timeLimitMinutes || 10
  );
  const [negativeMarking, setNegativeMarking] = useState<number>(
    initialPreset?.negativeMarking ?? 0
  );
  const [smartBoardMode, setSmartBoardMode] = useState<boolean>(
    Boolean(initialPreset?.smartBoardMode)
  );

  const [topicSearch, setTopicSearch] = useState('');
  const [groupTab, setGroupTab] = useState<GroupTab>('All');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [dailyStatus, setDailyStatus] = useState<DailyExamStatus | null>(null);
  const [recentHistory, setRecentHistory] = useState<QuizHistoryEntry[]>([]);
  const [inspectedHistoryResult, setInspectedHistoryResult] = useState<ExamResultSummary | null>(
    null
  );

  useEffect(() => {
    setMusicMode('focus');
    setRecentHistory(loadQuizHistory());
  }, [setMusicMode]);

  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.mode) setMode(initialPreset.mode);
      if (initialPreset.categoryId) setCategoryId(initialPreset.categoryId);
      if (initialPreset.subject) setSubject(initialPreset.subject);
      if (initialPreset.difficulty) setDifficulty(initialPreset.difficulty);
      if (initialPreset.questionCount) setQuestionCount(initialPreset.questionCount);
    }
  }, [initialPreset]);

  useEffect(() => {
    void safeFetchJson<{
      categories?: Array<{ id: string; questionCount?: number }>;
      subjects?: string[];
      chaptersBySubject?: Record<string, string[]>;
    }>('/api/exam/categories').then((res) => {
      if (res.ok && res.data) {
        if (Array.isArray(res.data.subjects)) setSubjects(res.data.subjects);
        if (res.data.chaptersBySubject) setChaptersBySubject(res.data.chaptersBySubject);
        if (Array.isArray(res.data.categories)) {
          const map: Record<string, number> = {};
          for (const c of res.data.categories) map[c.id] = c.questionCount || 0;
          setCategoryCounts(map);
        }
      }
    });

    void safeFetchJson<DailyExamStatus>(
      `/api/exam/daily-status?userId=${encodeURIComponent(examUserId)}`
    ).then((res) => {
      if (res.ok && res.data) setDailyStatus(res.data);
    });
  }, [examUserId]);

  const handleSelectMode = (nextMode: ExamMode) => {
    arcadeAudio.playSfx('click');
    setMode(nextMode);
    if (nextMode === 'quick' || nextMode === 'daily' || nextMode === 'career_fair') {
      setQuestionCount(10);
      setTimeLimitMinutes(8);
      setNegativeMarking(0);
    } else if (nextMode === 'standard' || nextMode === 'challenge' || nextMode === 'mixed') {
      setQuestionCount(20);
      setTimeLimitMinutes(20);
      setNegativeMarking(0);
    } else if (nextMode === 'jee' || nextMode === 'mock') {
      setQuestionCount(20);
      setTimeLimitMinutes(25);
      setNegativeMarking(1);
    } else if (nextMode === 'rapid') {
      setQuestionCount(10);
      setTimeLimitMinutes(2);
      setNegativeMarking(0);
    } else {
      setQuestionCount(10);
      setTimeLimitMinutes(12);
      setNegativeMarking(0);
    }
  };

  const filteredCategories = useMemo(() => {
    const cleanQuery = topicSearch
      .toLowerCase()
      .replace(/^quiz me on\s*/i, '')
      .trim();

    return EXAM_CATEGORIES.filter((cat) => {
      if (groupTab !== 'All' && cat.group !== groupTab) return false;
      if (!cleanQuery) return true;
      return (
        cat.name.toLowerCase().includes(cleanQuery) ||
        cat.shortName.toLowerCase().includes(cleanQuery) ||
        cat.description.toLowerCase().includes(cleanQuery) ||
        cat.id.toLowerCase().includes(cleanQuery)
      );
    });
  }, [groupTab, topicSearch]);

  const availableChapters = subject !== 'all' ? chaptersBySubject[subject] || [] : [];
  const dailyDone = mode === 'daily' && dailyStatus?.completed;
  const scoringRule = getModeScoringRules(mode, negativeMarking);

  const launch = (overrideCatId?: string) => {
    arcadeAudio.playSfx('gameStart');
    onStartQuiz({
      mode,
      categoryId: overrideCatId || categoryId,
      subject,
      chapter,
      difficulty,
      questionType,
      questionCount,
      timeLimitMinutes,
      negativeMarking,
      smartBoardMode,
    });
  };

  if (inspectedHistoryResult) {
    return (
      <div className="space-y-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <button
            type="button"
            onClick={() => setInspectedHistoryResult(null)}
            className="exam-btn exam-btn-secondary text-xs min-h-[44px]"
          >
            ← Back to Quiz Studio
          </button>
        </div>
        <QuizResultsView
          result={inspectedHistoryResult}
          onPlayAgain={() => {
            setInspectedHistoryResult(null);
            launch();
          }}
          onRetryWrong={(wrongIds) => {
            setInspectedHistoryResult(null);
            onStartQuiz({
              mode: 'revision',
              categoryId: 'all',
              subject: 'all',
              chapter: 'all',
              difficulty: 'Adaptive',
              questionType: 'All',
              questionCount: Math.max(5, wrongIds.length),
              timeLimitMinutes: 10,
              negativeMarking: 0,
              smartBoardMode,
            });
          }}
          onPracticeSimilar={(preset) => {
            setInspectedHistoryResult(null);
            onStartQuiz({
              mode: preset.mode || 'quick',
              categoryId: preset.categoryId || 'all',
              subject: preset.subject || 'all',
              chapter: 'all',
              difficulty: preset.difficulty || 'Adaptive',
              questionType: 'All',
              questionCount: preset.questionCount || 10,
              timeLimitMinutes: 10,
              negativeMarking: 0,
              smartBoardMode,
            });
          }}
          onBackToStudio={() => setInspectedHistoryResult(null)}
          onViewAnalytics={onOpenArcade}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <PixelMascot mood="thinking" size={52} />
          <div>
            <h1 className="font-pixel text-base sm:text-xl text-[var(--exam-text)]">
              ENGINEERING STUDIO
            </h1>
            <p className="text-sm text-[var(--exam-text-secondary)] mt-0.5">
              Search a topic or JEE/Career pathway, pick a mode, and launch.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setSmartBoardMode((v) => !v);
            }}
            className={`min-h-[44px] px-3 py-2 border-2 font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer ${
              smartBoardMode
                ? 'bg-[var(--exam-accent-soft)] border-[var(--exam-accent)] text-[var(--exam-accent)]'
                : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-secondary)]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>{smartBoardMode ? 'Smart Board: ON' : 'Smart Board'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenArcade();
            }}
            className="min-h-[44px] font-display-pixel text-xs sm:text-sm text-[var(--exam-accent)] hover:underline flex items-center gap-1.5 cursor-pointer px-2"
          >
            <PixelIcon name="arcade" size={15} />
            <span>Arcade Mini-Games →</span>
          </button>
        </div>
      </div>

      {/* Step 1: Topic Search + Grouped Engineering & Career Fair Cards */}
      <section className="exam-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-pixel text-xs text-[var(--exam-text-muted)]">
            1. TOPIC &amp; PATHWAY SELECTOR
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setGroupTab(tab);
                }}
                className={`min-h-[36px] px-2.5 py-1 border-2 font-display-pixel text-[11px] cursor-pointer ${
                  groupTab === tab
                    ? 'bg-[var(--exam-accent)] text-[#0B0F1A] border-[#0B0F1A]'
                    : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-secondary)] hover:text-[var(--exam-text)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Instant Topic Search Bar ("Quiz me on ECE / JEE Main / AI") */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--exam-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder='Try "Quiz me on ECE", "JEE Main", "TNEA", "AI", "GATE"...'
              aria-label="Search engineering quiz topics"
              className="exam-input w-full pl-9 pr-3 py-2.5 min-h-[48px] text-sm"
            />
          </div>
          {topicSearch.trim() && filteredCategories.length > 0 && (
            <button
              type="button"
              onClick={() => launch(filteredCategories[0].id)}
              className="exam-btn exam-btn-gold px-4 min-h-[48px] text-xs shrink-0"
            >
              Launch {filteredCategories[0].shortName} →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setCategoryId('all');
            }}
            className={`voxel-tile p-3.5 text-left cursor-pointer min-h-[78px] ${
              categoryId === 'all'
                ? 'bg-[var(--exam-accent-soft)] border-[var(--voxel-gold)] ring-2 ring-[var(--voxel-gold)]'
                : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-display-pixel text-xs font-bold text-[var(--exam-text)]">
                ALL ENGINEERING &amp; JEE
              </span>
              <span className="font-code text-[11px] text-[var(--exam-accent)]">Mixed</span>
            </div>
            <p className="text-xs text-[var(--exam-text-secondary)]">
              Balanced mix across branches, JEE pathways, admissions, and core STEM.
            </p>
          </button>

          {filteredCategories.map((cat) => {
            const active = categoryId === cat.id;
            const qCount = categoryCounts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setCategoryId(cat.id);
                }}
                className={`voxel-tile p-3.5 text-left cursor-pointer min-h-[78px] ${
                  active
                    ? 'bg-[var(--exam-accent-soft)] border-[var(--voxel-gold)] ring-2 ring-[var(--voxel-gold)]'
                    : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display-pixel text-xs font-bold text-[var(--exam-text)] truncate">
                    {cat.name}
                  </span>
                  <span className="font-code text-[11px] text-[var(--exam-accent)] shrink-0 tabular-nums">
                    {qCount > 0 ? `${qCount} Qs` : cat.shortName}
                  </span>
                </div>
                <p className="text-xs text-[var(--exam-text-secondary)] line-clamp-1">
                  {cat.description}
                </p>
                <div className="mt-1.5 font-code text-[10px] text-[var(--exam-text-muted)]">
                  {cat.group} · {cat.difficultyLabel || 'Mixed Level'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Game Modes */}
      <section className="space-y-3">
        <h2 className="font-pixel text-xs text-[var(--exam-text-muted)]">2. QUIZ MODE</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUIZ_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectMode(m.id)}
                className={`voxel-tile p-3.5 text-left cursor-pointer min-h-[68px] ${
                  active
                    ? 'bg-[var(--exam-accent-soft)] border-[var(--voxel-gold)] ring-2 ring-[var(--voxel-gold)]'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-display-pixel font-bold text-xs text-[var(--exam-text)] flex items-center gap-2">
                    <span className={active ? 'text-[var(--voxel-gold)]' : 'text-[var(--exam-accent)]'}>
                      <PixelIcon name={m.icon} size={15} />
                    </span>
                    {m.title}
                  </span>
                  {m.id === 'daily' && dailyStatus?.completed && (
                    <span className="font-display-pixel text-[10px] text-[var(--exam-success)]">
                      DONE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--exam-text-secondary)]">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {dailyDone && dailyStatus && (
        <div className="exam-card p-4 border-[var(--exam-success)] flex flex-wrap items-center justify-between gap-4">
          <div className="font-code text-xs sm:text-sm text-[var(--exam-text)]">
            <strong className="font-pixel text-xs text-[var(--exam-success)] mr-2">DAILY DONE!</strong>
            Score {dailyStatus.score}/{dailyStatus.maxScore} · {dailyStatus.accuracy}% · Rank #
            {dailyStatus.rank ?? 1}
          </div>
          <button
            type="button"
            onClick={() => handleSelectMode('quick')}
            className="exam-btn exam-btn-secondary text-xs min-h-[42px]"
          >
            Play Quick Quiz
          </button>
        </div>
      )}

      {/* Step 3: Clean Launch Footer */}
      <section className="exam-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setShowAdvanced((v) => !v);
            }}
            className="font-display-pixel text-xs sm:text-sm text-[var(--exam-accent)] hover:underline cursor-pointer min-h-[40px]"
          >
            {showAdvanced ? 'Hide Settings ▲' : 'Customize Settings ▼'}
          </button>

          <span className="font-code text-xs text-[var(--exam-text-muted)]">
            {questionCount} Qs · {timeLimitMinutes} min · {difficulty} · {scoringRule.label}
          </span>
        </div>

        {showAdvanced && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t-2 border-[var(--exam-border)]">
            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setChapter('all');
                }}
                className="exam-input w-full px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="all">All Engineering Subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Chapter
              </label>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                disabled={subject === 'all'}
                className="exam-input w-full px-3 py-2 text-sm min-h-[44px] disabled:opacity-50"
              >
                <option value="all">All Chapters</option>
                {availableChapters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ExamSettings['difficulty'])}
                className="exam-input w-full px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="Adaptive">Adaptive</option>
                <option value="Mixed">Mixed</option>
                <option value="Easy">Beginner (Easy)</option>
                <option value="Medium">Intermediate (Medium)</option>
                <option value="Hard">Advanced (Hard)</option>
                <option value="Expert">Challenge (Expert)</option>
              </select>
            </div>

            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Question Format
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as ExamSettings['questionType'])}
                className="exam-input w-full px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="All">All Formats</option>
                <option value="single">Single Choice MCQ</option>
                <option value="multiple">Multiple Correct</option>
                <option value="truefalse">True / False</option>
                <option value="scenario">Scenario Problem</option>
                <option value="comparison">Comparison</option>
                <option value="career_path">Career Path</option>
                <option value="match">Match Following</option>
                <option value="integer">Integer / Numeric</option>
                <option value="assertion_reason">Assertion / Reason</option>
                <option value="image">Diagram Based</option>
              </select>
            </div>

            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Questions
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                disabled={mode === 'quick' || mode === 'daily' || mode === 'career_fair'}
                className="exam-input w-full px-3 py-2 text-sm min-h-[44px] disabled:opacity-60"
              >
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} Questions
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-display-pixel text-xs text-[var(--exam-text-secondary)] mb-1">
                Timer &amp; Marking
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  aria-label="Time limit in minutes"
                  className="exam-input px-2.5 py-2 text-sm min-h-[44px]"
                >
                  {[2, 5, 8, 10, 15, 20, 25, 45].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <select
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(Number(e.target.value))}
                  aria-label="Negative marking penalty"
                  className="exam-input px-2.5 py-2 text-sm min-h-[44px]"
                >
                  <option value={0}>No Neg (0)</option>
                  <option value={0.25}>−0.25</option>
                  <option value={1}>−1 (JEE/Mock)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={Boolean(dailyDone)}
            onClick={() => launch()}
            className="exam-btn exam-btn-primary w-full sm:w-auto px-9 py-3.5 text-sm sm:text-base min-h-[52px]"
          >
            <PixelIcon name="play" size={16} />
            <span>START {QUIZ_MODES.find((x) => x.id === mode)?.title.toUpperCase()}</span>
          </button>
        </div>
      </section>

      {/* Compact Recent Quiz History Strip (clickable for instant review!) */}
      {recentHistory.length > 0 && (
        <section className="exam-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-pixel text-xs text-[var(--exam-text-muted)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--exam-accent)]" />
              RECENT QUIZ HISTORY
            </h2>
            <span className="font-code text-xs text-[var(--exam-text-muted)]">
              Tap a run to view full breakdown
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {recentHistory.slice(0, 3).map((item) => (
              <button
                key={item.attemptId}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setInspectedHistoryResult(item.summary);
                }}
                className="exam-card-subtle p-3 text-left hover:border-[var(--exam-accent)] cursor-pointer space-y-1 min-h-[64px]"
              >
                <div className="flex items-center justify-between gap-2 font-display-pixel text-xs text-[var(--exam-text)]">
                  <span className="uppercase truncate">{item.mode.replace('_', ' ')}</span>
                  <span className="text-[var(--exam-success)] tabular-nums">
                    {item.accuracy}%
                  </span>
                </div>
                <div className="font-code text-[11px] text-[var(--exam-text-muted)] tabular-nums">
                  {item.score}/{item.maxScore} pts · {item.totalQuestions} Qs
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
