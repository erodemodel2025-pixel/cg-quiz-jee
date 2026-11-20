import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  BookmarkCheck,
  Car,
  ChevronDown,
  Cpu,
  Gamepad2,
  Home,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Smartphone,
  Sparkles,
  Sun,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';

export type AppRoute =
  | 'home'
  | 'easy-quizzes'
  | 'arcade'
  | 'auto-engineer'
  | 'phone-designer'
  | 'leaderboard'
  | 'profile'
  | 'quiz-studio'
  | 'bank'
  | 'mistakes'
  | 'analytics'
  | 'admin';

interface TopNavProps {
  route: AppRoute;
  inActiveQuiz?: boolean;
  onNavigate: (route: AppRoute) => void;
  onQuickPlay: () => void;
  onOpenRegister: () => void;
  onOpenHowToPlay: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  route,
  onNavigate,
  onOpenRegister,
  onOpenHowToPlay,
}) => {
  const {
    player,
    uiTheme,
    toggleUiTheme,
    soundEnabled,
    toggleSound,
    musicEnabled,
    toggleMusic,
    isOnline,
    unlockAchievement,
    clearPlayerSession,
  } = useArcade();

  const [menuOpen, setMenuOpen] = useState(false);
  const logoClicksRef = useRef(0);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleLogoClick = () => {
    arcadeAudio.playSfx('click');
    logoClicksRef.current += 1;
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0;
      void unlockAchievement('logo_poke', 'CORE OVERHEAT!');
    }
    onNavigate('home');
    setMenuOpen(false);
  };

  const handleNav = (target: AppRoute) => {
    arcadeAudio.playSfx('click');
    onNavigate(target);
    setMenuOpen(false);
  };

  const navItems: Array<{ id: AppRoute; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'easy-quizzes', label: 'Easy Quizzes' },
    { id: 'arcade', label: 'Game Arena' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'profile', label: 'My Profile' },
  ];

  const isArenaChild =
    route === 'arcade' || route === 'auto-engineer' || route === 'phone-designer';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--studio-border-strong)] bg-[var(--studio-nav-bg)] backdrop-blur-md">
      <div
        ref={menuWrapRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8 relative"
      >
        {/* Zone 1: Crisp Single-Line Brand Wordmark */}
        <button
          type="button"
          onClick={handleLogoClick}
          className="cursor-pointer flex items-center gap-2.5 text-left shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--studio-accent-text)] rounded-lg py-1"
          aria-label="CG QUIZ STUDIO Home"
        >
          <span className="w-8 h-8 rounded-lg bg-[#2563EB] text-white font-heading font-bold text-xs flex items-center justify-center border border-[#60A5FA] shadow-[0_2px_0_#1E3A8A]">
            CG
          </span>
          <span className="font-heading font-bold text-base sm:text-lg tracking-tight text-[var(--studio-text)]">
            CG QUIZ STUDIO
          </span>
          {!isOnline && (
            <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 rounded bg-[#B45309] text-white">
              OFFLINE
            </span>
          )}
        </button>

        {/* Zone 2: Clean High-Contrast Single-Line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = item.id === 'arcade' ? isArenaChild : route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-2 text-sm font-sora font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'text-[var(--studio-accent-text)]'
                    : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text)]'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[1px] h-[3px] rounded-full bg-[var(--studio-accent-text)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Crisp Action & Menu Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {player ? (
            <div className="hidden sm:inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleNav('profile')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[var(--studio-surface-2)] border border-[var(--studio-border-strong)] hover:border-[var(--studio-accent-text)] text-xs cursor-pointer transition-colors"
              >
                <span className="w-6 h-6 rounded-md bg-[#2563EB] text-white font-heading font-bold flex items-center justify-center text-xs">
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-left leading-tight">
                  <span className="block font-sora font-bold text-xs text-[var(--studio-text)] max-w-[110px] truncate">
                    {player.name}
                  </span>
                  <span className="block font-mono-tech text-[10px] font-bold text-[var(--studio-accent-text)] tabular-nums">
                    LVL {player.level} · {player.xp} XP
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPlayerSession();
                  setMenuOpen(false);
                }}
                aria-label="Log out"
                title="Log out"
                className="studio-btn studio-btn-ghost text-xs px-2.5 py-2 min-h-[38px] text-[var(--studio-rose-text)] hover:border-[#F43F5E]"
              >
                <LogOut size={14} />
                <span className="hidden xl:inline">Log Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenRegister();
              }}
              className="studio-btn studio-btn-primary text-xs sm:text-sm px-4 py-2 min-h-[38px]"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setMenuOpen((v) => !v);
            }}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className={`studio-btn text-xs sm:text-sm px-3.5 py-2 min-h-[38px] ${
              menuOpen ? 'studio-btn-cyan' : 'studio-btn-ghost'
            }`}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
            <span className="hidden sm:inline">Menu</span>
            <ChevronDown size={14} className={`hidden sm:inline transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Studio Navigation & Controls Drawer */}
        {menuOpen && (
          <div
            className="absolute right-4 sm:right-6 top-[calc(100%+8px)] w-[min(94vw,356px)] studio-card-solid p-4 z-50 space-y-3 border-2 border-[var(--studio-border-strong)] shadow-2xl"
            role="menu"
          >
            <div className="p-3 rounded-xl studio-well flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-accent-text)]">
                  {player ? `${player.className} · Level ${player.level}` : 'Guest Session'}
                </div>
                <div className="font-sora text-sm font-bold text-[var(--studio-text)] truncate">
                  {player ? player.name : 'Creator Mode'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setMenuOpen(false);
                    if (player) onNavigate('profile');
                    else onOpenRegister();
                  }}
                  className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[34px]"
                >
                  {player ? 'Profile' : 'Set Name'}
                </button>
                {player && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      clearPlayerSession();
                    }}
                    aria-label="Log out of account"
                    className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px] text-[var(--studio-rose-text)] hover:border-[#F43F5E]"
                  >
                    <LogOut size={13} />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'home' as AppRoute, label: 'Home Studio', icon: <Home size={15} /> },
                { id: 'easy-quizzes' as AppRoute, label: 'Easy Quiz Zone (330+ Qs)', icon: <Sparkles size={15} /> },
                { id: 'auto-engineer' as AppRoute, label: '3D Automobile Engineer', icon: <Car size={15} /> },
                { id: 'phone-designer' as AppRoute, label: 'Design the Next iPhone', icon: <Smartphone size={15} /> },
                { id: 'arcade' as AppRoute, label: 'Game Arena & Classic Labs', icon: <Gamepad2 size={15} /> },
                { id: 'leaderboard' as AppRoute, label: 'Leaderboard & Trophy Room', icon: <Trophy size={15} /> },
              ].map((item) => {
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleNav(item.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-sora font-semibold flex items-center gap-2.5 cursor-pointer transition-colors border ${
                      active
                        ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)] hover:border-[var(--studio-accent-text)]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[var(--studio-border)]">
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] mb-2 px-1">
                Advanced Prep & Tools
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'quiz-studio' as AppRoute, label: 'Exam Studio', icon: <Cpu size={14} /> },
                  { id: 'bank' as AppRoute, label: 'Question Bank', icon: <BookOpen size={14} /> },
                  { id: 'mistakes' as AppRoute, label: 'Mistake Book', icon: <BookmarkCheck size={14} /> },
                  { id: 'analytics' as AppRoute, label: 'Analytics', icon: <LineChart size={14} /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleNav(item.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-sora font-semibold flex items-center gap-2 cursor-pointer border transition-colors ${
                      route === item.id
                        ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)] hover:border-[var(--studio-accent-text)]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio & Display Toggles */}
            <div className="pt-2 border-t border-[var(--studio-border)] grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => toggleSound()}
                className="py-2 px-1 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] hover:border-[var(--studio-accent-text)] text-[var(--studio-text)] flex flex-col items-center justify-center gap-1 text-[10px] font-mono-tech font-bold cursor-pointer"
                aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
              >
                {soundEnabled ? <Volume2 size={14} className="text-[var(--studio-accent-text)]" /> : <VolumeX size={14} className="text-[var(--studio-text-muted)]" />}
                <span>{soundEnabled ? 'SFX ON' : 'MUTE'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleMusic()}
                className="py-2 px-1 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] hover:border-[var(--studio-accent-text)] text-[var(--studio-text)] flex flex-col items-center justify-center gap-1 text-[10px] font-mono-tech font-bold cursor-pointer"
                aria-label={musicEnabled ? 'Mute music' : 'Enable music'}
              >
                <Zap size={14} className={musicEnabled ? 'text-[var(--studio-purple-text)]' : 'text-[var(--studio-text-muted)]'} />
                <span>{musicEnabled ? 'BGM ON' : 'BGM OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  toggleUiTheme();
                }}
                className="py-2 px-1 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] hover:border-[var(--studio-accent-text)] text-[var(--studio-text)] flex flex-col items-center justify-center gap-1 text-[10px] font-mono-tech font-bold cursor-pointer"
              >
                {uiTheme === 'dark' ? <Sun size={14} className="text-[var(--studio-amber-text)]" /> : <Moon size={14} className="text-[var(--studio-accent-text)]" />}
                <span>{uiTheme === 'dark' ? 'LIGHT' : 'DARK'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setMenuOpen(false);
                  onOpenHowToPlay();
                }}
                className="py-2 px-1 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] hover:border-[var(--studio-accent-text)] text-[var(--studio-text)] flex flex-col items-center justify-center gap-1 text-[10px] font-mono-tech font-bold cursor-pointer"
              >
                <BookOpen size={14} className="text-[var(--studio-emerald-text)]" />
                <span>GUIDE</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
