import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Car,
  Check,
  Flame,
  Lock,
  LogOut,
  Palette,
  Smartphone,
  Trash2,
  Trophy,
  UserPlus,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  computeLevelFromXp,
  PIXEL_THEMES,
} from '../../shared/progression.ts';
import type { SavedCreation, SubmissionRecord } from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import {
  getGuestOrUserId,
  listCreations,
  removeCreation,
} from '../utils/creationsStore.ts';

interface ProfilePageProps {
  onOpenRegister: () => void;
  onPlay: () => void;
  onOpenCreation: (creation: SavedCreation) => void;
  onOpenAutoEngineer: () => void;
  onOpenPhoneDesigner: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onOpenRegister,
  onPlay,
  onOpenCreation,
  onOpenAutoEngineer,
  onOpenPhoneDesigner,
}) => {
  const { player, activeTheme, equipTheme, clearPlayerSession, setMusicMode, reportError } =
    useArcade();
  const userId = getGuestOrUserId(player?.id);

  const [history, setHistory] = useState<SubmissionRecord[]>([]);
  const [creations, setCreations] = useState<SavedCreation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  const loadCreations = useCallback(async () => {
    const list = await listCreations(userId);
    setCreations(list);
  }, [userId]);

  useEffect(() => {
    void loadCreations();
  }, [loadCreations]);

  useEffect(() => {
    if (!player) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    void safeFetchJson<{ history?: SubmissionRecord[] }>(
      `/api/players/${encodeURIComponent(player.id)}`
    )
      .then((res) => {
        if (res.ok && res.data && Array.isArray(res.data.history)) {
          setHistory(res.data.history);
        } else if (!res.ok && res.error) {
          reportError(res.error);
        }
      })
      .finally(() => setLoadingHistory(false));
  }, [player, reportError]);

  const handleDeleteCreation = async (id: string) => {
    arcadeAudio.playSfx('click');
    await removeCreation(id, userId);
    await loadCreations();
  };

  const lvl = player ? computeLevelFromXp(player.xp) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-6">
      {/* Studio Creator Card OR Sign-In CTA */}
      {!player || !lvl ? (
        <div className="studio-card p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-lg">
              <UserPlus size={26} />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl sm:text-2xl text-[var(--studio-text)]">
                Guest Creator Studio
              </h1>
              <p className="text-sm text-[var(--studio-text-secondary)] mt-1 max-w-xl">
                Sign in with your Name and Class to sync XP, earn achievement badges, unlock themes, and climb the global leaderboard.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenRegister();
            }}
            className="studio-btn studio-btn-primary px-6 py-3 text-sm shrink-0"
          >
            Sign In / Set Handle
          </button>
        </div>
      ) : (
        <div className="studio-card p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-emerald-text)] mb-1 uppercase tracking-wider">
              {player.className} · {player.gamesPlayed} Runs Completed
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--studio-text)] mb-1">
              {player.name}
            </h1>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
              LEVEL {lvl.level} — {lvl.title.toUpperCase()}
            </div>
          </div>

          <div className="w-full md:w-80">
            <div className="flex justify-between font-mono-tech text-xs font-bold text-[var(--studio-text-secondary)] mb-1.5 tabular-nums">
              <span>{player.xp} XP</span>
              <span>{lvl.nextLevelXp ? `NEXT LVL: ${lvl.nextLevelXp} XP` : 'MAX RANK'}</span>
            </div>
            <div className="h-3 rounded-full bg-[var(--studio-surface-2)] border border-[var(--studio-border-strong)] overflow-hidden mb-3">
              <div
                className="h-full bg-[#2563EB]"
                style={{ width: `${lvl.progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs font-mono-tech font-bold">
              <span className="text-[var(--studio-amber-text)] flex items-center gap-1">
                <Flame size={14} /> Best Streak: {player.streakBest}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearPlayerSession();
                }}
                className="studio-btn studio-btn-ghost px-3.5 py-1.5 min-h-[34px] text-xs text-[var(--studio-rose-text)] hover:border-[#F43F5E]"
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MY CREATIONS: SAVED 3D CARS & NEXT iPHONE CONCEPTS */}
      <div className="studio-card-solid p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
              My Studio Creations ({creations.length})
            </h2>
            <p className="text-xs text-[var(--studio-text-secondary)]">
              Reopen your saved 3D automobiles and custom smartphones in their design studios anytime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenAutoEngineer();
              }}
              className="studio-btn studio-btn-cyan text-xs px-3.5 py-1.5 min-h-[36px]"
            >
              <Car size={14} /> New Car
            </button>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenPhoneDesigner();
              }}
              className="studio-btn studio-btn-purple text-xs px-3.5 py-1.5 min-h-[36px]"
            >
              <Smartphone size={14} /> New Phone
            </button>
          </div>
        </div>

        {creations.length === 0 ? (
          <div className="p-6 studio-well text-center text-sm text-[var(--studio-text-secondary)]">
            You haven&apos;t saved any vehicles or smartphones yet. Open a creative studio above and hit Save!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creations.map((c) => (
              <div
                key={c.id}
                className="p-4 studio-well flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {c.previewDataUrl ? (
                    <img
                      src={c.previewDataUrl}
                      alt={c.title}
                      className="w-20 h-16 rounded-xl object-cover border border-[var(--studio-border-strong)] shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                      {c.type === 'car' ? <Car size={24} /> : <Smartphone size={24} />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--studio-accent-text)]">
                      {c.type === 'car' ? 'Automobile Build' : 'Smartphone Concept'}
                    </div>
                    <div className="font-heading font-bold text-base text-[var(--studio-text)] truncate">
                      {c.title}
                    </div>
                    <div className="text-xs text-[var(--studio-text-muted)] truncate">{c.subtitle}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--studio-border)] flex items-center justify-between gap-2">
                  <div className="font-mono-tech text-xs font-bold text-[var(--studio-emerald-text)] tabular-nums">
                    Rating {c.designRating}/100 · ${c.estimatedCost.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.playSfx('click');
                        onOpenCreation(c);
                      }}
                      className="studio-btn studio-btn-primary text-xs px-3 py-1 min-h-[32px]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCreation(c.id)}
                      aria-label={`Delete ${c.title}`}
                      className="studio-btn studio-btn-ghost p-1.5 min-h-[32px] text-[var(--studio-rose-text)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signed-In Details: Themes, Achievements, History */}
      {player && lvl && (
        <>
          <div className="studio-card-solid p-6 space-y-4">
            <h2 className="font-heading font-bold text-base text-[var(--studio-accent-text)] flex items-center gap-2">
              <Palette size={17} /> Unlockable Lab Palettes
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PIXEL_THEMES.map((theme) => {
                const unlocked =
                  player.unlockedThemes.includes(theme.id) || lvl.level >= theme.unlockLevel;
                const equipped = activeTheme === theme.id;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => void equipTheme(theme.id)}
                    className={`p-4 rounded-xl border-2 text-left flex flex-col justify-between cursor-pointer transition-all ${
                      equipped
                        ? 'bg-[var(--studio-surface-2)] border-[#2563EB]'
                        : unlocked
                          ? 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] hover:border-[var(--studio-accent-text)]'
                          : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] opacity-55 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex gap-1.5">
                          {theme.swatches.map((hex, i) => (
                            <span
                              key={i}
                              className="w-4 h-4 rounded-full border border-[var(--studio-border-strong)] inline-block"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        {equipped ? (
                          <Check size={14} className="text-[var(--studio-accent-text)]" />
                        ) : !unlocked ? (
                          <Lock size={14} className="text-[var(--studio-text-muted)]" />
                        ) : null}
                      </div>
                      <div className="font-sora font-bold text-xs text-[var(--studio-text)] mb-1">
                        {theme.name}
                      </div>
                      <p className="text-xs text-[var(--studio-text-secondary)]">{theme.description}</p>
                    </div>
                    <div className="font-mono-tech text-[11px] font-bold mt-3 text-[var(--studio-accent-text)]">
                      {equipped
                        ? 'EQUIPPED'
                        : unlocked
                          ? 'Click to Equip'
                          : `Unlocks at Level ${theme.unlockLevel}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="studio-card-solid p-6 space-y-4">
            <h2 className="font-heading font-bold text-base text-[var(--studio-amber-text)] flex items-center gap-2">
              <Award size={17} /> Studio Achievements ({player.achievements.length}/{ACHIEVEMENTS.length})
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const has = player.achievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`p-3.5 rounded-xl border-2 ${
                      has
                        ? 'studio-well border-[#10B981]'
                        : 'studio-well opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`font-sora font-bold text-xs ${
                          has ? 'text-[var(--studio-emerald-text)]' : 'text-[var(--studio-text)]'
                        }`}
                      >
                        {ach.name}
                      </span>
                      <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
                        +{ach.xpBonus} XP
                      </span>
                    </div>
                    <p className="text-xs text-[var(--studio-text-secondary)]">{ach.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="studio-card-solid p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading font-bold text-base text-[var(--studio-purple-text)] flex items-center gap-2">
                <Trophy size={17} /> Recent Quiz &amp; Arcade Runs
              </h2>
              <button
                type="button"
                onClick={onPlay}
                className="studio-btn studio-btn-primary text-xs px-4 py-1.5 min-h-[36px]"
              >
                Play Quizzes
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-sm text-[var(--studio-text-secondary)]">Loading runs...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-[var(--studio-text-secondary)]">
                No quiz runs recorded yet. Launch Easy Quiz Zone or any Game Arena mode to log your record!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono-tech text-xs sm:text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--studio-border)] text-[var(--studio-text-muted)]">
                      <th className="py-2 pr-4">ACTIVITY</th>
                      <th className="py-2 pr-4">MODE</th>
                      <th className="py-2 pr-4 text-right">SCORE</th>
                      <th className="py-2 pr-4 text-right">ACC</th>
                      <th className="py-2 text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-[var(--studio-border)] last:border-0">
                        <td className="py-2.5 pr-4 font-bold text-[var(--studio-text)]">{h.gameType}</td>
                        <td className="py-2.5 pr-4 uppercase font-bold text-[var(--studio-accent-text)]">
                          {h.mode}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-bold text-[var(--studio-amber-text)]">
                          {h.score}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-bold text-[var(--studio-emerald-text)]">
                          {Math.round(h.accuracy)}%
                        </td>
                        <td className="py-2.5 text-right font-bold text-[var(--studio-purple-text)]">
                          +{h.xpEarned}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
