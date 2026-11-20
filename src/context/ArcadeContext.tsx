import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { arcadeAudio, type MusicMode } from '../audio/arcadeAudio.ts';
import type { ClassOption, PixelThemeId, PlayerProfile, UiThemeMode } from '../../shared/types.ts';
import { safeFetchJson } from '../utils/apiClient.ts';
import {
  getOrCreateGuestUserId,
  readOfflineCache,
  runSafeStorageMigration,
  updateOfflineCache,
} from '../utils/storageMigration.ts';

const LEGACY_STORAGE_KEY = 'cgquiz_participant';
const PLAYER_STORAGE_KEY = 'cgquiz_arcade_player';
const MOTION_KEY = 'cgquiz_reduced_motion';
const UI_THEME_KEY = 'cgquiz_ui_theme';

interface CelebrationEvent {
  id: number;
  title: string;
  subtitle: string;
  color: string;
}

interface ArcadeContextValue {
  player: PlayerProfile | null;
  examUserId: string;
  loadingPlayer: boolean;
  activeTheme: PixelThemeId;
  uiTheme: UiThemeMode;
  isOnline: boolean;
  bookmarkedIds: string[];
  soundEnabled: boolean;
  musicEnabled: boolean;
  reducedMotion: boolean;
  celebration: CelebrationEvent | null;
  recentErrors: string[];
  registerPlayer: (name: string, className: ClassOption, isTest?: boolean) => Promise<{ ok: boolean; error?: string }>;
  refreshPlayer: () => Promise<void>;
  updateLocalPlayer: (player: PlayerProfile | null) => void;
  equipTheme: (themeId: PixelThemeId) => Promise<void>;
  toggleUiTheme: () => void;
  toggleBookmark: (questionId: string) => Promise<void>;
  toggleSound: () => void;
  toggleMusic: () => void;
  toggleReducedMotion: () => void;
  setMusicMode: (mode: MusicMode) => void;
  triggerCelebration: (title: string, subtitle: string, color?: string) => void;
  unlockAchievement: (achievementId: string, label?: string) => Promise<void>;
  reportError: (msg: string) => void;
  clearPlayerSession: () => void;
}

const ArcadeContext = createContext<ArcadeContextValue | null>(null);

export const ArcadeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [guestId] = useState<string>(() => getOrCreateGuestUserId());
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [activeTheme, setActiveTheme] = useState<PixelThemeId>('cyber-midnight');
  const [uiTheme, setUiTheme] = useState<UiThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(UI_THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => readOfflineCache().bookmarks);
  const [soundEnabled, setSoundEnabled] = useState(() => arcadeAudio.getPrefs().soundEnabled);
  const [musicEnabled, setMusicEnabled] = useState(() => arcadeAudio.getPrefs().musicEnabled);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(MOTION_KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);

  const examUserId = player?.id || guestId;

  const reportError = useCallback((msg: string) => {
    setRecentErrors((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 20));
  }, []);

  const triggerCelebration = useCallback((title: string, subtitle: string, color = '#FFE600') => {
    setCelebration({ id: Date.now(), title, subtitle, color });
    window.setTimeout(() => {
      setCelebration((curr) => (curr && Date.now() - curr.id >= 3800 ? null : curr));
    }, 4000);
  }, []);

  useEffect(() => {
    runSafeStorageMigration();
  }, []);

  // Online/offline tracking
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Apply Dark/Light academic mode on <html>
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(uiTheme);
    document.documentElement.setAttribute('data-ui-mode', uiTheme);
    try {
      localStorage.setItem(UI_THEME_KEY, uiTheme);
    } catch {
      // ignore
    }
  }, [uiTheme]);

  // Sync audio prefs & global pointer unlock for autoplay compliance
  useEffect(() => {
    const unsub = arcadeAudio.subscribe((prefs) => {
      setSoundEnabled(prefs.soundEnabled);
      setMusicEnabled(prefs.musicEnabled);
    });
    const unlockOnce = () => {
      arcadeAudio.unlock();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  // Apply arcade pixel theme & reduced motion on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    try {
      localStorage.setItem(MOTION_KEY, String(reducedMotion));
    } catch {
      // ignore
    }
  }, [reducedMotion]);

  // Restore or migrate existing cgquiz_participant without overwriting server records
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const storedPlayerRaw = localStorage.getItem(PLAYER_STORAGE_KEY);
        if (storedPlayerRaw) {
          const parsed = JSON.parse(storedPlayerRaw) as PlayerProfile;
          const res = await safeFetchJson<{ player: PlayerProfile }>(
            `/api/players/${encodeURIComponent(parsed.id)}`
          );
          if (res.ok && res.data?.player) {
            const data = res.data;
            if (active) {
              setPlayer(data.player);
              setActiveTheme(data.player.activeTheme || 'cyber-midnight');
              localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(data.player));
            }
            setLoadingPlayer(false);
            return;
          }
        }

        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as {
            id?: string;
            name?: string;
            className?: ClassOption;
          };
          if (legacy.name && legacy.className) {
            const res = await safeFetchJson<{ player: PlayerProfile }>('/api/players/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: legacy.name,
                className: legacy.className,
                existingId: legacy.id,
              }),
            });
            if (res.ok && res.data?.player) {
              const data = res.data;
              if (active) {
                setPlayer(data.player);
                setActiveTheme(data.player.activeTheme || 'cyber-midnight');
                localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(data.player));
              }
            }
          }
        }
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Session restore error');
      } finally {
        if (active) setLoadingPlayer(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reportError]);

  // Sync bookmarks from server when online
  useEffect(() => {
    if (!examUserId || !isOnline) return;
    void safeFetchJson<{ questionIds?: string[] }>(
      `/api/exam/bookmarks?userId=${encodeURIComponent(examUserId)}`
    ).then((res) => {
      if (res.ok && res.data && Array.isArray(res.data.questionIds)) {
        setBookmarkedIds(res.data.questionIds);
        updateOfflineCache({ bookmarks: res.data.questionIds });
      }
    });
  }, [examUserId, isOnline]);

  const toggleBookmark = useCallback(
    async (questionId: string) => {
      const exists = bookmarkedIds.includes(questionId);
      const next = exists
        ? bookmarkedIds.filter((id) => id !== questionId)
        : [questionId, ...bookmarkedIds];
      setBookmarkedIds(next);
      updateOfflineCache({ bookmarks: next });

      if (!isOnline) return;
      try {
        if (exists) {
          await safeFetchJson(
            `/api/exam/bookmarks/${encodeURIComponent(questionId)}?userId=${encodeURIComponent(examUserId)}`,
            { method: 'DELETE' }
          );
        } else {
          await safeFetchJson(`/api/exam/bookmarks/${encodeURIComponent(questionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: examUserId }),
          });
        }
      } catch (err) {
        reportError(String(err));
      }
    },
    [bookmarkedIds, examUserId, isOnline, reportError]
  );

  const updateLocalPlayer = useCallback((next: PlayerProfile | null) => {
    setPlayer(next);
    if (next) {
      setActiveTheme(next.activeTheme || 'cyber-midnight');
      try {
        localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(
          LEGACY_STORAGE_KEY,
          JSON.stringify({ id: next.id, name: next.name, className: next.className })
        );
      } catch {
        // ignore
      }
    }
  }, []);

  const refreshPlayer = useCallback(async () => {
    if (!player) return;
    try {
      const res = await safeFetchJson<{ player: PlayerProfile }>(
        `/api/players/${encodeURIComponent(player.id)}`
      );
      if (res.ok && res.data?.player) {
        updateLocalPlayer(res.data.player);
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [player, reportError, updateLocalPlayer]);

  const registerPlayer = useCallback(
    async (name: string, className: ClassOption, isTest = false) => {
      try {
        const res = await safeFetchJson<{
          player?: PlayerProfile;
          signedInExisting?: boolean;
          error?: string;
        }>(
          '/api/players/register',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, className, isTest }),
          }
        );
        if (!res.ok || !res.data?.player) {
          arcadeAudio.playSfx('wrong');
          return { ok: false, error: res.error || res.data?.error || 'Registration failed.' };
        }
        arcadeAudio.playSfx('coin');
        updateLocalPlayer(res.data.player);
        triggerCelebration(
          res.data.signedInExisting ? 'WELCOME BACK' : 'PLAYER REGISTERED',
          `${res.data.player.name} (${res.data.player.className})`,
          '#00F0FF'
        );
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        reportError(msg);
        return { ok: false, error: msg };
      }
    },
    [reportError, triggerCelebration, updateLocalPlayer]
  );

  const equipTheme = useCallback(
    async (themeId: PixelThemeId) => {
      arcadeAudio.playSfx('click');
      if (!player) {
        setActiveTheme(themeId);
        return;
      }
      try {
        const res = await safeFetchJson<{ player: PlayerProfile }>(
          `/api/players/${encodeURIComponent(player.id)}/theme`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeId }),
          }
        );
        if (res.ok && res.data?.player) {
          updateLocalPlayer(res.data.player);
          arcadeAudio.playSfx('coin');
        }
      } catch (err) {
        reportError(String(err));
      }
    },
    [player, reportError, updateLocalPlayer]
  );

  const unlockAchievement = useCallback(
    async (achievementId: string, label?: string) => {
      if (!player) {
        triggerCelebration('SECRET DISCOVERED!', label || achievementId.toUpperCase(), '#A855F7');
        arcadeAudio.playSfx('coin');
        return;
      }
      if (player.achievements.includes(achievementId)) return;
      try {
        const res = await safeFetchJson<{
          player: PlayerProfile;
          newlyUnlocked: boolean;
          xpBonus?: number;
        }>(`/api/players/${encodeURIComponent(player.id)}/achievement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementId }),
        });
        if (res.ok && res.data) {
          const data = res.data;
          if (data.newlyUnlocked) {
            updateLocalPlayer(data.player);
            arcadeAudio.playSfx('levelUp');
            triggerCelebration(
              label || 'ACHIEVEMENT UNLOCKED!',
              `+${data.xpBonus ?? 50} BONUS XP`,
              '#FFE600'
            );
          }
        }
      } catch (err) {
        reportError(String(err));
      }
    },
    [player, reportError, triggerCelebration, updateLocalPlayer]
  );

  const clearPlayerSession = useCallback(() => {
    arcadeAudio.playSfx('click');
    setPlayer(null);
    setActiveTheme('cyber-midnight');
    try {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      sessionStorage.removeItem('cgquiz_last_game_session');
    } catch {
      // ignore
    }
    triggerCelebration('SIGNED OUT', 'Logged out cleanly. Sign in anytime to continue.', '#94A3B8');
  }, [triggerCelebration]);

  return (
    <ArcadeContext.Provider
      value={{
        player,
        examUserId,
        loadingPlayer,
        activeTheme,
        uiTheme,
        isOnline,
        bookmarkedIds,
        soundEnabled,
        musicEnabled,
        reducedMotion,
        celebration,
        recentErrors,
        registerPlayer,
        refreshPlayer,
        updateLocalPlayer,
        equipTheme,
        toggleUiTheme: () => setUiTheme((t) => (t === 'dark' ? 'light' : 'dark')),
        toggleBookmark,
        toggleSound: () => arcadeAudio.toggleSound(),
        toggleMusic: () => arcadeAudio.toggleMusic(),
        toggleReducedMotion: () => setReducedMotion((v) => !v),
        setMusicMode: (m) => arcadeAudio.setMusicMode(m),
        triggerCelebration,
        unlockAchievement,
        reportError,
        clearPlayerSession,
      }}
    >
      {children}
    </ArcadeContext.Provider>
  );
};

export function useArcade(): ArcadeContextValue {
  const ctx = useContext(ArcadeContext);
  if (!ctx) throw new Error('useArcade must be used inside ArcadeProvider');
  return ctx;
}
