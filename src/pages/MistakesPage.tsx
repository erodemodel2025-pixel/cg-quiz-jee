import React, { useCallback, useEffect, useState } from 'react';
import type {
  ExamQuestion,
  ExamSettings,
  MistakeCategory,
  MistakeRecord,
} from '../../shared/types.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import { readOfflineCache, updateOfflineCache } from '../utils/storageMigration.ts';
import { formatAnswerLabel } from '../components/quiz/SmartExplanationCard.tsx';
import { PixelIcon, PixelIllustration, PixelLoader } from '../components/pixel/PixelArtAssets.tsx';

interface MistakesPageProps {
  onStartRevision: (questionIds: string[], settings?: Partial<ExamSettings>) => void;
}

const MISTAKE_TYPES: Array<{ id: MistakeCategory; label: string }> = [
  { id: 'concept', label: 'Concept Gap' },
  { id: 'calculation', label: 'Calculation Error' },
  { id: 'formula', label: 'Formula Error' },
  { id: 'careless', label: 'Careless Mistake' },
  { id: 'time-pressure', label: 'Time Pressure' },
  { id: 'guessing', label: 'Guessing' },
];

export const MistakesPage: React.FC<MistakesPageProps> = ({ onStartRevision }) => {
  const { examUserId, isOnline, toggleBookmark, setMusicMode, reportError } = useArcade();
  const [activeTab, setActiveTab] = useState<'mistakes' | 'saved'>('mistakes');
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [savedItems, setSavedItems] = useState<ExamQuestion[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!isOnline) {
        const cache = readOfflineCache();
        setMistakes(cache.mistakes);
        setLoading(false);
        return;
      }

      const [mRes, bRes] = await Promise.all([
        safeFetchJson<{ mistakes?: MistakeRecord[] }>(
          `/api/exam/mistakes?userId=${encodeURIComponent(examUserId)}`
        ),
        safeFetchJson<{ items?: ExamQuestion[] }>(
          `/api/exam/bookmarks?userId=${encodeURIComponent(examUserId)}`
        ),
      ]);
      if (mRes.ok && mRes.data) {
        setMistakes(mRes.data.mistakes || []);
        updateOfflineCache({ mistakes: mRes.data.mistakes || [] });
      }
      if (bRes.ok && bRes.data) {
        setSavedItems(bRes.data.items || []);
      }
    } catch (err) {
      reportError(String(err));
    } finally {
      setLoading(false);
    }
  }, [examUserId, isOnline, reportError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateMistakeCategory = async (questionId: string, cat: MistakeCategory) => {
    setMistakes((prev) =>
      prev.map((m) => (m.questionId === questionId ? { ...m, mistakeCategory: cat } : m))
    );
    if (!isOnline) return;
    await safeFetchJson(`/api/exam/mistakes/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: examUserId, mistakeCategory: cat }),
    });
  };

  const resolveOrRemove = async (questionId: string) => {
    setMistakes((prev) => prev.filter((m) => m.questionId !== questionId));
    if (!isOnline) return;
    await safeFetchJson(
      `/api/exam/mistakes/${encodeURIComponent(questionId)}?userId=${encodeURIComponent(examUserId)}`,
      { method: 'DELETE' }
    );
  };

  const visibleMistakes = mistakes.filter((m) =>
    filterCategory === 'all' ? true : m.mistakeCategory === filterCategory
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base sm:text-xl text-[var(--exam-text)]">
            MY MISTAKES &amp; SAVED
          </h1>
          <p className="text-sm text-[var(--exam-text-secondary)] mt-1">
            Review missed questions, tag error reasons, and replay weak spots.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'mistakes' && visibleMistakes.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onStartRevision(
                  visibleMistakes.map((m) => m.questionId),
                  { mode: 'revision' }
                )
              }
              className="exam-btn exam-btn-primary text-xs sm:text-sm"
            >
              <PixelIcon name="refresh" size={14} /> Retry Mistakes ({visibleMistakes.length})
            </button>
          )}
          {activeTab === 'saved' && savedItems.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onStartRevision(
                  savedItems.map((q) => q.id),
                  { mode: 'practice' }
                )
              }
              className="exam-btn exam-btn-primary text-xs sm:text-sm"
            >
              <PixelIcon name="play" size={14} /> Practice Saved ({savedItems.length})
            </button>
          )}
        </div>
      </div>

      {/* Blocky Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-[var(--exam-border)] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('mistakes')}
            className={`px-4 py-2 border-2 font-display-pixel text-xs sm:text-sm cursor-pointer ${
              activeTab === 'mistakes'
                ? 'bg-[var(--voxel-gold)] text-[#0B0F1A] border-[#0B0F1A]'
                : 'bg-[var(--exam-surface)] border-[var(--exam-border)] text-[var(--exam-text-secondary)]'
            }`}
          >
            Mistakes ({mistakes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 border-2 font-display-pixel text-xs sm:text-sm cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-[var(--voxel-gold)] text-[#0B0F1A] border-[#0B0F1A]'
                : 'bg-[var(--exam-surface)] border-[var(--exam-border)] text-[var(--exam-text-secondary)]'
            }`}
          >
            Saved ({savedItems.length})
          </button>
        </div>

        {activeTab === 'mistakes' && mistakes.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by mistake category"
            className="exam-input px-3 py-2 text-xs sm:text-sm"
          >
            <option value="all">All Mistake Types</option>
            {MISTAKE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="exam-card p-8">
          <PixelLoader label="OPENING MISTAKE BOOK..." />
        </div>
      ) : activeTab === 'mistakes' ? (
        visibleMistakes.length === 0 ? (
          <div className="exam-card p-8 text-center space-y-3">
            <PixelIllustration name="books" size={56} className="mx-auto" />
            <div className="font-pixel text-sm text-[var(--exam-text)]">NO MISTAKES YET!</div>
            <p className="text-sm text-[var(--exam-text-secondary)]">
              Wrong answers during any quiz are saved here with explanations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMistakes.map((m) => (
              <div key={m.id} className="exam-card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-display-pixel text-xs text-[var(--exam-text-muted)]">
                      {m.subject} · {m.topic} · Missed {m.timesMissed}x
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--exam-text)] mt-1">
                      {m.question?.question || m.questionId}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.mistakeCategory}
                      onChange={(e) =>
                        void updateMistakeCategory(m.questionId, e.target.value as MistakeCategory)
                      }
                      aria-label="Mistake category"
                      className="exam-input px-2.5 py-1.5 text-xs"
                    >
                      {MISTAKE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void resolveOrRemove(m.questionId)}
                      aria-label="Remove mistake"
                      className="p-2 border-2 border-[var(--exam-border)] text-[var(--exam-text-muted)] hover:text-[var(--exam-danger)] cursor-pointer"
                    >
                      <PixelIcon name="close" size={14} />
                    </button>
                  </div>
                </div>

                {m.question && (
                  <div className="exam-card-subtle p-3.5 text-xs sm:text-sm space-y-1.5">
                    <div className="text-[var(--exam-success)] font-semibold">
                      Correct:{' '}
                      {formatAnswerLabel(
                        m.question.questionType,
                        m.question.answer,
                        m.question.options,
                        m.question.matchPairs?.right
                      )}
                    </div>
                    <div className="text-[var(--exam-text-secondary)]">
                      <strong>Why:</strong> {m.question.explanation.why}
                    </div>
                    <div className="text-[var(--exam-warning)]">
                      <strong>Trap:</strong> {m.question.explanation.commonTrap}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1 text-xs font-display-pixel">
                  <button
                    type="button"
                    onClick={() => onStartRevision([m.questionId], { mode: 'revision' })}
                    className="text-[var(--exam-accent)] hover:underline cursor-pointer"
                  >
                    Retry This Question →
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onStartRevision([], {
                        mode: 'practice',
                        subject: m.subject,
                        difficulty: 'Medium',
                      })
                    }
                    className="text-[var(--exam-text-secondary)] hover:underline cursor-pointer"
                  >
                    Practice {m.subject}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : savedItems.length === 0 ? (
        <div className="exam-card p-8 text-center space-y-3">
          <PixelIllustration name="question_block" size={56} className="mx-auto" />
          <div className="font-pixel text-sm text-[var(--exam-text)]">NO SAVED QUESTIONS</div>
          <p className="text-sm text-[var(--exam-text-secondary)]">
            Bookmark tricky questions during quizzes or in the Question Bank to review them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedItems.map((q) => (
            <div key={q.id} className="exam-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display-pixel text-xs text-[var(--exam-text-muted)]">
                    {q.subject} · {q.chapter} · {q.difficulty}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--exam-text)] mt-1">
                    {q.question}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void toggleBookmark(q.id);
                    setSavedItems((prev) => prev.filter((item) => item.id !== q.id));
                  }}
                  aria-label="Remove bookmark"
                  className="p-2 border-2 border-[var(--exam-warning)] text-[var(--exam-warning)] cursor-pointer"
                >
                  <PixelIcon name="bookmark" size={14} />
                </button>
              </div>
              <div className="text-xs sm:text-sm text-[var(--exam-success)] font-semibold">
                Answer: {formatAnswerLabel(q.questionType, q.answer, q.options, q.matchPairs?.right)}
              </div>
              <div className="text-xs sm:text-sm text-[var(--exam-text-secondary)]">
                {q.explanation.why}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
