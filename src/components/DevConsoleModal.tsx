import React, { useCallback, useEffect, useState } from 'react';
import { Bug, Music, RefreshCw, ShieldAlert, Trash2, Volume2, X } from 'lucide-react';
import { arcadeAudio, type MusicMode, type SfxName } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import type { EngineeringQuestion, GameModeId } from '../../shared/types.ts';

interface DevConsoleModalProps {
  open: boolean;
  onClose: () => void;
  onJumpGame: (game: GameModeId) => void;
  onOpenAdmin?: () => void;
}

const DEV_TOKEN = 'arcade-matrix-dev';

const ALL_SFX: SfxName[] = [
  'click',
  'gameStart',
  'coin',
  'correct',
  'wrong',
  'combo',
  'levelUp',
  'bossIntro',
  'victory',
  'gameOver',
  'drumRoll',
  'vineBoom',
  'sadTrombone',
  'airhorn',
  'bonk',
  'oof',
  'baDumTss',
  'wow',
];

const ALL_MUSIC: MusicMode[] = [
  'home',
  'focus',
  'gameplay',
  'excitement',
  'tension',
  'boss',
  'trophy',
  'victory',
  'sad',
];

export const DevConsoleModal: React.FC<DevConsoleModalProps> = ({
  open,
  onClose,
  onJumpGame,
  onOpenAdmin,
}) => {
  const { recentErrors, registerPlayer, reportError } = useArcade();
  const [diag, setDiag] = useState<{
    realPlayers: number;
    testPlayers: number;
    realSubmissions: number;
    testSubmissions: number;
    questionCount: number;
    categoryCount: number;
    recentErrors: Array<{ id: number; endpoint: string; message: string; created_at: string }>;
  } | null>(null);
  const [questions, setQuestions] = useState<EngineeringQuestion[]>([]);
  const [logMsg, setLogMsg] = useState('');

  const loadDiagnostics = useCallback(async () => {
    try {
      const [dRes, qRes] = await Promise.all([
        safeFetchJson<NonNullable<typeof diag>>('/api/dev/diagnostics', {
          headers: { 'x-cgquiz-dev': DEV_TOKEN },
        }),
        safeFetchJson<{ questions?: EngineeringQuestion[] }>('/api/dev/questions', {
          headers: { 'x-cgquiz-dev': DEV_TOKEN },
        }),
      ]);
      if (dRes.ok && dRes.data) setDiag(dRes.data);
      if (qRes.ok && qRes.data) {
        setQuestions(qRes.data.questions || []);
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [reportError]);

  useEffect(() => {
    if (open) {
      void loadDiagnostics();
    }
  }, [open, loadDiagnostics]);

  if (!open) return null;

  const runTestRegistrationAndScore = async () => {
    const handle = `DevBot_${Math.floor(Math.random() * 9000 + 1000)}`;
    const reg = await registerPlayer(handle, 'Other', true);
    if (!reg.ok) {
      setLogMsg(`Registration test failed: ${reg.error}`);
      return;
    }
    const startRes = await safeFetchJson<{ sessionId?: string }>('/api/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'competitive', gameType: 'iq-quiz', playerId: reg ? undefined : null, isTest: true }),
    });
    setLogMsg(
      `Created sandbox test player ${handle}; quiz session ${startRes.data?.sessionId || 'error'} verified.`
    );
    await loadDiagnostics();
  };

  const resetTestDataOnly = async () => {
    const res = await safeFetchJson<{
      cleared?: { testPlayers?: number; testSubmissions?: number };
    }>('/api/dev/reset-test', {
      method: 'POST',
      headers: { 'x-cgquiz-dev': DEV_TOKEN },
    });
    const data = res.data;
    setLogMsg(
      `Reset test data ONLY: ${data?.cleared?.testPlayers ?? 0} test players, ${
        data?.cleared?.testSubmissions ?? 0
      } test runs deleted. Real player records untouched!`
    );
    await loadDiagnostics();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="pixel-panel max-w-4xl w-full p-6 my-8 border-[#FF6B00] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b-2 border-[var(--border-pixel)]">
          <div className="flex items-center gap-2 font-pixel text-xs sm:text-sm text-[#FF6B00]">
            <Bug size={18} /> HIDDEN DEVELOPER TEST CONSOLE
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-ghost p-2"
            aria-label="Close developer console"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diagnostics */}
        {diag && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 font-code text-xs">
            <div className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
              <div className="text-[var(--text-muted)]">REAL PLAYERS</div>
              <div className="text-lg font-bold text-[#22FF66]">{diag.realPlayers}</div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
              <div className="text-[var(--text-muted)]">TEST PLAYERS</div>
              <div className="text-lg font-bold text-[#FF6B00]">{diag.testPlayers}</div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
              <div className="text-[var(--text-muted)]">REAL RUNS</div>
              <div className="text-lg font-bold text-[#00F0FF]">{diag.realSubmissions}</div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
              <div className="text-[var(--text-muted)]">QUESTIONS</div>
              <div className="text-lg font-bold text-[#FFE600]">
                {diag.questionCount} ({diag.categoryCount} cats)
              </div>
            </div>
          </div>
        )}

        {/* Preview All 6 Games */}
        <div className="mb-5">
          <div className="font-pixel text-[10px] text-[#00F0FF] mb-2">PREVIEW ALL GAME MODES</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                'iq-quiz',
                'circuit-rush',
                'code-breaker',
                'boss-battle',
                'logic-lab',
                'component-match',
              ] as GameModeId[]
            ).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  onJumpGame(g);
                  onClose();
                }}
                className="pixel-btn pixel-btn-cyan px-3 py-2 text-[10px]"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Audition All 10 SFX & 4 Music Tracks */}
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          <div className="p-4 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
            <div className="font-pixel text-[10px] text-[#FFE600] flex items-center gap-1.5 mb-2">
              <Volume2 size={14} /> TEST SOUND EFFECTS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SFX.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => arcadeAudio.playSfx(s, 4)}
                  className="px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-pixel)] hover:border-[#FFE600] font-code text-xs cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)]">
            <div className="font-pixel text-[10px] text-[#22FF66] flex items-center gap-1.5 mb-2">
              <Music size={14} /> TEST BACKGROUND MUSIC
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_MUSIC.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    arcadeAudio.unlock();
                    arcadeAudio.setMusicMode(m);
                  }}
                  className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-pixel)] hover:border-[#22FF66] font-code text-xs uppercase cursor-pointer"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Registration / Leaderboard / Safe Reset */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={() => void runTestRegistrationAndScore()}
            className="pixel-btn pixel-btn-purple px-4 py-2.5 text-[10px]"
          >
            Test Sandbox Registration
          </button>
          <button
            type="button"
            onClick={() => void loadDiagnostics()}
            className="pixel-btn pixel-btn-ghost px-4 py-2.5 text-[10px]"
          >
            <RefreshCw size={14} /> Refresh Diagnostics
          </button>
          <button
            type="button"
            onClick={() => void resetTestDataOnly()}
            className="pixel-btn pixel-btn-orange px-4 py-2.5 text-[10px]"
          >
            <Trash2 size={14} /> Reset Test Data Only
          </button>
          {onOpenAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="pixel-btn pixel-btn-green px-4 py-2.5 text-[10px]"
            >
              Manage Questions (Admin)
            </button>
          )}
        </div>

        {logMsg && (
          <div className="p-3 mb-4 bg-[#0B2E1A] border-2 border-[#22FF66] font-code text-xs text-[#DCFFE8]">
            {logMsg}
          </div>
        )}

        {/* Question Bank Sample Inspector & Error Log */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] max-h-56 overflow-y-auto">
            <div className="font-pixel text-[10px] text-[#00F0FF] mb-2">
              QUESTION BANK CHECK ({questions.length})
            </div>
            <div className="space-y-2 font-code text-xs">
              {questions.slice(0, 12).map((q) => (
                <div key={q.id} className="border-b border-[var(--border-pixel)] pb-1.5">
                  <span className="text-[#FFE600]">[{q.id}]</span> {q.question}{' '}
                  <span className="text-[#22FF66]">→ {q.options[q.correctIndex]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] max-h-56 overflow-y-auto">
            <div className="font-pixel text-[10px] text-[#FF6B6B] flex items-center gap-1.5 mb-2">
              <ShieldAlert size={14} /> RUNTIME & API ERRORS
            </div>
            {recentErrors.length === 0 && (!diag?.recentErrors || diag.recentErrors.length === 0) ? (
              <div className="font-code text-xs text-[#22FF66]">No errors captured.</div>
            ) : (
              <div className="space-y-1 font-code text-xs text-[#FFD1D1]">
                {recentErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
                {diag?.recentErrors?.map((e) => (
                  <div key={e.id}>
                    {e.endpoint}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
