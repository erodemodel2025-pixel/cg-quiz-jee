import React, { useState } from 'react';
import { ArcadeProvider, useArcade } from './context/ArcadeContext.tsx';
import { HowToPlayModal } from './components/pixel/HowToPlayModal.tsx';
import { TopNav, type AppRoute } from './components/TopNav.tsx';
import { RegisterModal } from './components/RegisterModal.tsx';
import { PixelCelebration } from './components/PixelCelebration.tsx';
import { DevConsoleModal } from './components/DevConsoleModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { EasyQuizPage } from './pages/EasyQuizPage.tsx';
import { QuizStudioPage } from './pages/QuizStudioPage.tsx';
import { QuestionBankPage } from './pages/QuestionBankPage.tsx';
import { MistakesPage } from './pages/MistakesPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { ArcadeHubPage } from './pages/ArcadeHubPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { AdminQuestionsPage } from './pages/AdminQuestionsPage.tsx';
import { QuizRunner } from './components/quiz/QuizRunner.tsx';
import { EngineeringIQQuiz } from './components/games/EngineeringIQQuiz.tsx';
import { CircuitRushGame } from './components/games/CircuitRushGame.tsx';
import { CodeBreakerGame } from './components/games/CodeBreakerGame.tsx';
import { BossBattleGame } from './components/games/BossBattleGame.tsx';
import { LogicLabGame } from './components/games/LogicLabGame.tsx';
import { ComponentMatchGame } from './components/games/ComponentMatchGame.tsx';
import { AutoEngineerGame } from './components/games/auto/AutoEngineerGame.tsx';
import type { CarBuildConfig } from './components/games/auto/carCatalog.ts';
import { PhoneDesignerGame } from './components/games/phone/PhoneDesignerGame.tsx';
import type { PhoneDesignState } from './components/games/phone/phoneCatalog.ts';
import type { ExamSettings, GameModeId, QuizMode, SavedCreation } from '../shared/types.ts';
import type { ActiveQuizDraft } from './utils/storageMigration.ts';

const DEFAULT_SETTINGS: ExamSettings = {
  mode: 'quick',
  categoryId: 'all',
  subject: 'all',
  chapter: 'all',
  difficulty: 'Adaptive',
  questionType: 'All',
  questionCount: 10,
  timeLimitMinutes: 8,
  negativeMarking: 0,
};

function ArcadeShell() {
  const { reportError } = useArcade();
  const [route, setRoute] = useState<AppRoute>('home');
  const [activeGame, setActiveGame] = useState<GameModeId | null>(null);
  const [iqMode, setIqMode] = useState<QuizMode>('practice');
  const [activeExamSettings, setActiveExamSettings] = useState<ExamSettings | null>(null);
  const [customExamQuestionIds, setCustomExamQuestionIds] = useState<string[] | undefined>(undefined);
  const [resumedDraft, setResumedDraft] = useState<ActiveQuizDraft | null>(null);
  const [examRunKey, setExamRunKey] = useState(0);
  const [studioPreset, setStudioPreset] = useState<Partial<ExamSettings> | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [loadedCreation, setLoadedCreation] = useState<SavedCreation | null>(null);

  const navigate = (next: AppRoute) => {
    setActiveGame(null);
    setActiveExamSettings(null);
    setCustomExamQuestionIds(undefined);
    setResumedDraft(null);
    if (next !== 'auto-engineer' && next !== 'phone-designer') {
      setLoadedCreation(null);
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const launchGame = (game: GameModeId, mode: QuizMode = 'practice') => {
    setActiveExamSettings(null);
    setResumedDraft(null);
    setLoadedCreation(null);
    if (game === 'auto-engineer') {
      setActiveGame(null);
      setRoute('auto-engineer');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (game === 'phone-designer') {
      setActiveGame(null);
      setRoute('phone-designer');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    setIqMode(mode);
    setRoute('arcade');
    setActiveGame(game);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openCreationInStudio = (creation: SavedCreation) => {
    setActiveGame(null);
    setActiveExamSettings(null);
    setLoadedCreation(creation);
    setRoute(creation.type === 'car' ? 'auto-engineer' : 'phone-designer');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const startExamQuiz = (preset: Partial<ExamSettings> = {}, customIds?: string[]) => {
    setActiveGame(null);
    setResumedDraft(null);
    setCustomExamQuestionIds(customIds);
    setActiveExamSettings({
      ...DEFAULT_SETTINGS,
      ...preset,
    });
    setExamRunKey((k) => k + 1);
    setRoute('quiz-studio');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const resumeExamDraft = (draft: ActiveQuizDraft) => {
    setActiveGame(null);
    setCustomExamQuestionIds(undefined);
    setResumedDraft(draft);
    setActiveExamSettings(draft.settings);
    setExamRunKey((k) => k + 1);
    setRoute('quiz-studio');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const isFullscreenStudio = route === 'auto-engineer' || route === 'phone-designer';

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--studio-bg)] text-[var(--studio-text)]">
      <TopNav
        route={route}
        inActiveQuiz={Boolean(activeExamSettings)}
        onNavigate={navigate}
        onQuickPlay={() => navigate('easy-quizzes')}
        onOpenRegister={() => setRegisterOpen(true)}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
      />

      <main className={`flex-1 relative z-10 ${isFullscreenStudio ? 'pb-0' : 'pb-12'}`}>
        <ErrorBoundary onGoHome={() => navigate('home')} onReportError={reportError}>
          {activeGame ? (
            <>
              {activeGame === 'iq-quiz' && (
                <EngineeringIQQuiz
                  initialMode={iqMode}
                  onExit={() => setActiveGame(null)}
                  onRequireRegister={() => setRegisterOpen(true)}
                />
              )}
              {activeGame === 'circuit-rush' && (
                <CircuitRushGame onExit={() => setActiveGame(null)} />
              )}
              {activeGame === 'code-breaker' && (
                <CodeBreakerGame onExit={() => setActiveGame(null)} />
              )}
              {activeGame === 'boss-battle' && (
                <BossBattleGame onExit={() => setActiveGame(null)} />
              )}
              {activeGame === 'logic-lab' && (
                <LogicLabGame onExit={() => setActiveGame(null)} />
              )}
              {activeGame === 'component-match' && (
                <ComponentMatchGame onExit={() => setActiveGame(null)} />
              )}
            </>
          ) : activeExamSettings ? (
            <QuizRunner
              key={examRunKey}
              initialSettings={activeExamSettings}
              customQuestionIds={customExamQuestionIds}
              initialDraft={resumedDraft}
              onExit={() => {
                setActiveExamSettings(null);
                setCustomExamQuestionIds(undefined);
                setResumedDraft(null);
              }}
              onPlayAgain={() => startExamQuiz(activeExamSettings, customExamQuestionIds)}
              onRetryWrongIds={(wrongIds) =>
                startExamQuiz({ mode: 'revision', questionCount: wrongIds.length }, wrongIds)
              }
              onPracticeSimilar={(preset) => startExamQuiz(preset)}
              onViewAnalytics={() => navigate('analytics')}
            />
          ) : (
            <>
              {route === 'home' && (
                <HomePage
                  onOpenEasyQuiz={() => navigate('easy-quizzes')}
                  onOpenAutoEngineer={() => {
                    setLoadedCreation(null);
                    navigate('auto-engineer');
                  }}
                  onOpenPhoneDesigner={() => {
                    setLoadedCreation(null);
                    navigate('phone-designer');
                  }}
                  onOpenArena={() => navigate('arcade')}
                  onOpenExamStudio={() => navigate('quiz-studio')}
                  onResumeDraft={(draft) => resumeExamDraft(draft)}
                  onOpenTrophyRoom={() => navigate('leaderboard')}
                  onOpenCreation={openCreationInStudio}
                />
              )}
              {route === 'easy-quizzes' && (
                <EasyQuizPage
                  onOpenAdvancedStudio={() => navigate('quiz-studio')}
                  onOpenArena={() => navigate('arcade')}
                  onOpenLeaderboard={() => navigate('leaderboard')}
                  onRequireRegister={() => setRegisterOpen(true)}
                />
              )}
              {route === 'auto-engineer' && (
                <AutoEngineerGame
                  key={loadedCreation?.id || 'new-car'}
                  initialBuild={
                    loadedCreation?.type === 'car'
                      ? (loadedCreation.payload as Partial<CarBuildConfig>)
                      : null
                  }
                  initialTitle={loadedCreation?.type === 'car' ? loadedCreation.title : null}
                  initialCreationId={loadedCreation?.type === 'car' ? loadedCreation.id : null}
                  onExit={() => navigate('arcade')}
                />
              )}
              {route === 'phone-designer' && (
                <PhoneDesignerGame
                  key={loadedCreation?.id || 'new-phone'}
                  initialDesign={
                    loadedCreation?.type === 'phone'
                      ? (loadedCreation.payload as Partial<PhoneDesignState>)
                      : null
                  }
                  initialCreationId={loadedCreation?.type === 'phone' ? loadedCreation.id : null}
                  onExit={() => navigate('arcade')}
                />
              )}
              {route === 'quiz-studio' && (
                <QuizStudioPage
                  initialPreset={studioPreset}
                  onStartQuiz={(settings) => startExamQuiz(settings)}
                  onOpenArcade={() => navigate('arcade')}
                />
              )}
              {route === 'bank' && (
                <QuestionBankPage
                  onPracticeQuestions={(ids, preset) =>
                    startExamQuiz({ mode: 'practice', questionCount: ids.length, ...preset }, ids)
                  }
                />
              )}
              {route === 'mistakes' && (
                <MistakesPage
                  onStartRevision={(ids, preset) =>
                    startExamQuiz(
                      { mode: preset?.mode || 'revision', questionCount: ids.length || 10, ...preset },
                      ids.length > 0 ? ids : undefined
                    )
                  }
                />
              )}
              {route === 'analytics' && (
                <AnalyticsPage
                  onStartQuiz={(preset, ids) => {
                    if (preset && !ids) {
                      setStudioPreset(preset);
                    }
                    startExamQuiz(preset || { mode: 'quick' }, ids);
                  }}
                />
              )}
              {route === 'arcade' && (
                <ArcadeHubPage
                  onSelectGame={(g, m) => launchGame(g, m)}
                  onOpenAutoEngineer={() => {
                    setLoadedCreation(null);
                    navigate('auto-engineer');
                  }}
                  onOpenPhoneDesigner={() => {
                    setLoadedCreation(null);
                    navigate('phone-designer');
                  }}
                />
              )}
              {route === 'leaderboard' && (
                <LeaderboardPage onPlayCompete={() => navigate('easy-quizzes')} />
              )}
              {route === 'profile' && (
                <ProfilePage
                  onOpenRegister={() => setRegisterOpen(true)}
                  onPlay={() => navigate('easy-quizzes')}
                  onOpenCreation={openCreationInStudio}
                  onOpenAutoEngineer={() => {
                    setLoadedCreation(null);
                    navigate('auto-engineer');
                  }}
                  onOpenPhoneDesigner={() => {
                    setLoadedCreation(null);
                    navigate('phone-designer');
                  }}
                />
              )}
              {route === 'admin' && (
                <AdminQuestionsPage onBack={() => navigate('home')} />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {!isFullscreenStudio && (
        <footer className="relative z-10 border-t border-[var(--studio-border)] bg-[var(--exam-nav-bg)] py-5 px-4 text-center font-mono-tech text-xs text-[var(--studio-text-muted)]">
          CG QUIZ STUDIO · LEARN. BUILD. PLAY. CREATE.
        </footer>
      )}

      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} />

      <HowToPlayModal
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
        onStartQuiz={() => navigate('easy-quizzes')}
      />

      <PixelCelebration onTriggerDevMode={() => setDevOpen(true)} />

      <DevConsoleModal
        open={devOpen}
        onClose={() => setDevOpen(false)}
        onJumpGame={(g) => launchGame(g, 'practice')}
        onOpenAdmin={() => navigate('admin')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ArcadeProvider>
      <ArcadeShell />
    </ArcadeProvider>
  );
}
