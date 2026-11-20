import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Car,
  Cpu,
  Gamepad2,
  Play,
  Smartphone,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { EASY_QUESTIONS } from '../../shared/easyQuestions.ts';
import type { AnalyticsSummary, SavedCreation } from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import { getGuestOrUserId, listCreations } from '../utils/creationsStore.ts';
import { loadActiveQuizDraft, type ActiveQuizDraft } from '../utils/storageMigration.ts';

interface HomePageProps {
  onOpenEasyQuiz: () => void;
  onOpenAutoEngineer: () => void;
  onOpenPhoneDesigner: () => void;
  onOpenArena: () => void;
  onOpenExamStudio: () => void;
  onResumeDraft: (draft: ActiveQuizDraft) => void;
  onOpenTrophyRoom: () => void;
  onOpenCreation: (creation: SavedCreation) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenEasyQuiz,
  onOpenAutoEngineer,
  onOpenPhoneDesigner,
  onOpenArena,
  onOpenExamStudio,
  onResumeDraft,
  onOpenTrophyRoom,
  onOpenCreation,
}) => {
  const { player, examUserId, setMusicMode } = useArcade();
  const userId = getGuestOrUserId(player?.id);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentCreations, setRecentCreations] = useState<SavedCreation[]>([]);
  const [draft] = useState(() => loadActiveQuizDraft());

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  useEffect(() => {
    void safeFetchJson<AnalyticsSummary>(
      `/api/exam/analytics?userId=${encodeURIComponent(examUserId)}&range=7d`
    ).then((res) => {
      if (res.ok && res.data) setAnalytics(res.data);
    });
    void listCreations(userId).then((items) => setRecentCreations(items.slice(0, 3)));
  }, [examUserId, userId]);

  const featuredExperiences = [
    {
      id: 'easy-quiz',
      kicker: `Knowledge Zone · ${EASY_QUESTIONS.length}+ Questions · 11 Topics`,
      title: 'Easy Quiz Zone',
      description:
        'Test your instincts across 11 beginner-friendly categories from General Knowledge and Science to Space, AI, and Cars — with instant clear explanations.',
      image: '/src/assets/images/card_easy_quiz_1795174514172.jpg',
      btnClass: 'studio-btn-emerald',
      icon: Sparkles,
      cta: 'Play Easy Quizzes',
      onClick: onOpenEasyQuiz,
    },
    {
      id: 'auto-engineer',
      kicker: '3D Garage · 8 Platforms · 13 Mod Systems',
      title: 'Become an Automobile Engineer',
      description:
        'Enter the real-time Three.js 3D car studio. Pick from 8 vehicles, customize 13 part systems, tune suspension and EV or V8 powertrains, and save builds.',
      image: '/src/assets/images/card_auto_engineer_1795174514567.jpg',
      btnClass: 'studio-btn-cyan',
      icon: Car,
      cta: 'Launch 3D Car Studio',
      onClick: onOpenAutoEngineer,
    },
    {
      id: 'phone-designer',
      kicker: 'Hardware Lab · 24 Components · 5 Challenges',
      title: 'Design the Next iPhone',
      description:
        'Arrange cameras, Dynamic Capsules, titanium trims, and wireless charging coils across Front and Rear hardware views, complete design challenges, and export.',
      image: '/src/assets/images/card_phone_designer_1795174514396.jpg',
      btnClass: 'studio-btn-purple',
      icon: Smartphone,
      cta: 'Open Phone Designer',
      onClick: onOpenPhoneDesigner,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
      {/* HERO SECTION: Crisp Elevated Surface with Strong Contrast */}
      <section className="studio-card px-6 py-8 sm:px-10 sm:py-12 border border-[var(--studio-border-strong)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-5">
            <div className="font-mono-tech text-xs font-bold tracking-widest text-[var(--studio-accent-text)] uppercase">
              CG Quiz Studio · Learn. Build. Play. Create.
            </div>

            <h1 className="font-heading font-bold text-3xl sm:text-5xl lg:text-[52px] leading-[1.08] tracking-tight text-[var(--studio-text)] max-w-2xl">
              Your Next Level{' '}
              <span className="text-[var(--studio-accent-text)]">Starts Here.</span>
            </h1>

            <p className="font-sora text-base sm:text-lg text-[var(--studio-text-secondary)] max-w-2xl leading-relaxed">
              Challenge your knowledge across 11 quiz subjects, customize 3D automobiles in real time, and engineer next-generation smartphones.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('gameStart');
                  onOpenEasyQuiz();
                }}
                className="studio-btn studio-btn-primary px-6 py-3 text-sm"
              >
                <Play size={16} fill="currentColor" />
                <span>Start Easy Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onOpenArena();
                }}
                className="studio-btn studio-btn-purple px-5 py-3 text-sm"
              >
                <Gamepad2 size={16} />
                <span>Enter Game Arena</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onOpenExamStudio();
                }}
                className="studio-btn studio-btn-ghost px-4 py-3 text-xs sm:text-sm"
              >
                <Cpu size={15} className="text-[var(--studio-accent-text)]" />
                <span>Engineering Exam Studio</span>
              </button>
            </div>

            {draft && draft.questions?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onResumeDraft(draft);
                }}
                className="inline-flex items-center gap-2 text-xs font-mono-tech font-bold text-[var(--studio-emerald-text)] hover:underline cursor-pointer pt-1"
              >
                <span>Resume saved exam draft ({draft.mode}) →</span>
              </button>
            )}
          </div>

          {/* Right Quick Summary Panel */}
          <div className="lg:col-span-4 studio-well p-5 space-y-4">
            <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
              Studio Modules
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--studio-border)]">
                <span className="font-sora text-sm font-semibold text-[var(--studio-text)]">Easy Quiz Bank</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-emerald-text)] tabular-nums">
                  {EASY_QUESTIONS.length}+ Qs
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--studio-border)]">
                <span className="font-sora text-sm font-semibold text-[var(--studio-text)]">3D Car Engineer</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-cyan-text)] tabular-nums">
                  8 Vehicles
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--studio-border)]">
                <span className="font-sora text-sm font-semibold text-[var(--studio-text)]">iPhone Designer</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-purple-text)] tabular-nums">
                  24 Parts
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-sora text-sm font-semibold text-[var(--studio-text)]">Classic Arcade Labs</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)] tabular-nums">
                  6 Games
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenTrophyRoom();
              }}
              className="studio-btn studio-btn-amber w-full text-xs py-2.5"
            >
              <Trophy size={15} />
              <span>View Trophy Room &amp; Ranks</span>
            </button>
          </div>
        </div>
      </section>

      {/* THREE FLAGSHIP EXPERIENCES */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
              Interactive Studios
            </div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--studio-text)] mt-0.5">
              Choose Your Studio Mission
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {featuredExperiences.map((exp) => {
            const Icon = exp.icon;
            return (
              <div
                key={exp.id}
                className="studio-card-interactive overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-video w-full overflow-hidden bg-[#0B1120] border-b border-[var(--studio-border)]">
                    <img
                      src={exp.image}
                      alt={exp.title}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090E1A]/85 via-transparent to-transparent" />
                  </div>

                  <div className="p-6 space-y-2.5">
                    <div className="flex items-center gap-2 font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                      <Icon size={14} />
                      <span>{exp.kicker}</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl sm:text-2xl text-[var(--studio-text)]">
                      {exp.title}
                    </h3>
                    <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                      {exp.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      exp.onClick();
                    }}
                    className={`w-full studio-btn ${exp.btnClass} text-sm py-3`}
                  >
                    <span>{exp.cta}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RECENT CREATIONS & STATS STRIP */}
      {(recentCreations.length > 0 || analytics?.hasData) && (
        <section className="studio-card-solid p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                {recentCreations.length > 0 ? 'Your Latest Studio Creations' : 'Your Progress Snapshot'}
              </h2>
              {analytics?.hasData && (
                <p className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                  {analytics.streaks.examXp} Exam XP · {analytics.overallAccuracy}% Accuracy · {analytics.streaks.dailyStreak}d Streak
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenArena();
              }}
              className="studio-btn studio-btn-ghost text-xs px-3.5 py-2 min-h-[36px]"
            >
              <span>Explore Game Arena</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {recentCreations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentCreations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    onOpenCreation(c);
                  }}
                  className="p-3.5 rounded-xl studio-well hover:border-[var(--studio-accent-text)] text-left flex items-center gap-3 cursor-pointer transition-colors"
                >
                  {c.previewDataUrl ? (
                    <img
                      src={c.previewDataUrl}
                      alt={c.title}
                      className="w-16 h-12 rounded-lg object-cover border border-[var(--studio-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                      {c.type === 'car' ? <Car size={20} /> : <Smartphone size={20} />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-sora font-bold text-sm text-[var(--studio-text)] truncate">
                      {c.title}
                    </div>
                    <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-accent-text)]">
                      {c.type === 'car' ? '3D Car Build' : 'Phone Design'} · Rating {c.designRating}/100
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
