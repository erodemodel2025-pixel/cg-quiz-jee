import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flame, Heart, RotateCcw, Shield, Skull, Swords, Zap } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import { FUNNY_GAME_OVER_MESSAGES } from '../../../shared/progression.ts';
import type { PublicQuestion } from '../../../shared/types.ts';

interface BossBattleGameProps {
  onExit: () => void;
}

const BOSS_PORTRAIT = '/src/assets/images/pixel_boss_golem_1794827929479.jpg';

export const BossBattleGame: React.FC<BossBattleGameProps> = ({ onExit }) => {
  const { player, setMusicMode, updateLocalPlayer, triggerCelebration, reportError, reducedMotion } =
    useArcade();

  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [bossHp, setBossHp] = useState(100);
  const [playerEnergy, setPlayerEnergy] = useState(100);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selectedIndex: number; timeMs: number }>>([]);
  const [battleLog, setBattleLog] = useState('ENTROPY GOLEM blocks the mainframe! Strike with correct answers!');
  const [bossHitAnim, setBossHitAnim] = useState(false);
  const [playerHitAnim, setPlayerHitAnim] = useState(false);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState<'victory' | 'defeat' | null>(null);
  const [result, setResult] = useState<{ score: number; xpEarned: number; correctCount: number } | null>(null);
  const [funnyDefeat] = useState(
    () => FUNNY_GAME_OVER_MESSAGES[Math.floor(Math.random() * FUNNY_GAME_OVER_MESSAGES.length)]
  );
  const qStartRef = useRef(Date.now());
  const startedRef = useRef(false);

  const startBossFight = useCallback(async () => {
    try {
      const res = await safeFetchJson<{ sessionId: string; questions: PublicQuestion[] }>(
        '/api/quiz/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'practice',
            gameType: 'boss-battle',
            categoryId: 'all',
            difficulty: 'MIXED',
            playerId: player?.id ?? null,
          }),
        }
      );
      if (res.ok && res.data && Array.isArray(res.data.questions)) {
        const data = res.data;
        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setIdx(0);
        setBossHp(100);
        setPlayerEnergy(100);
        setStreak(0);
        setAnswers([]);
        setLocked(false);
        setFinished(null);
        setResult(null);
        setBattleLog('ENTROPY GOLEM appears! Round 3 & Round 6 are 2x CRITICAL BONUS rounds!');
        qStartRef.current = Date.now();
        soundManager.playBossIntro();
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [player?.id, reportError]);

  useEffect(() => {
    if (finished === 'victory') {
      setMusicMode('victory');
    } else if (finished === 'defeat') {
      setMusicMode('home');
    } else {
      setMusicMode('boss');
    }
  }, [finished, setMusicMode]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startBossFight();
    }
  }, [startBossFight]);

  const finishBattle = async (
    outcome: 'victory' | 'defeat',
    finalAnswers: Array<{ questionId: string; selectedIndex: number; timeMs: number }>
  ) => {
    setFinished(outcome);
    if (outcome === 'victory') {
      soundManager.playVictory();
    } else {
      soundManager.playGameOver();
    }

    try {
      const res = await safeFetchJson<{
        score: number;
        xpEarned: number;
        correctCount: number;
        leveledUp?: boolean;
        player?: NonNullable<typeof player>;
      }>('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId: player?.id ?? null,
          answers: finalAnswers,
          bossWon: outcome === 'victory',
        }),
      });
      if (res.ok && res.data) {
        const data = res.data;
        setResult({
          score: data.score,
          xpEarned: data.xpEarned,
          correctCount: data.correctCount,
        });
        if (data.player) updateLocalPlayer(data.player);
        if (data.leveledUp && data.player) {
          soundManager.playLevelUp();
          triggerCelebration('BOSS LEVEL UP!', `Level ${data.player.level}: ${data.player.title}`, '#FFE600');
        }
      }
    } catch (err) {
      reportError(String(err));
    }
  };

  const handleStrike = async (optIdx: number) => {
    if (locked || finished || !questions[idx]) return;
    setLocked(true);
    const q = questions[idx];
    const timeMs = Date.now() - qStartRef.current;
    const isBonusRound = idx === 2 || idx === 5;
    const nextAnswers = [...answers, { questionId: q.id, selectedIndex: optIdx, timeMs }];
    setAnswers(nextAnswers);

    try {
      const res = await safeFetchJson<{ correct: boolean; correctIndex: number; explanation: string }>(
        '/api/quiz/check',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, questionId: q.id, selectedIndex: optIdx }),
        }
      );
      if (!res.ok || !res.data) {
        setLocked(false);
        reportError(res.error || 'Answer check failed');
        return;
      }
      const check = res.data;

      let nextBossHp = bossHp;
      let nextEnergy = playerEnergy;

      if (check.correct) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        const dmg = isBonusRound ? 30 : 18 + Math.min(8, nextStreak * 2);
        nextBossHp = Math.max(0, bossHp - dmg);
        setBossHp(nextBossHp);
        setBossHitAnim(true);
        window.setTimeout(() => setBossHitAnim(false), 350);
        if (isBonusRound) {
          soundManager.playCombo(nextStreak);
        } else {
          soundManager.playCorrect();
        }
        setBattleLog(
          isBonusRound
            ? `CRITICAL LASER! -${dmg} Boss HP! ${check.explanation}`
            : `DIRECT HIT! -${dmg} Boss HP! ${check.explanation}`
        );
      } else {
        setStreak(0);
        const bossDmg = isBonusRound ? 35 : 25;
        nextEnergy = Math.max(0, playerEnergy - bossDmg);
        setPlayerEnergy(nextEnergy);
        setPlayerHitAnim(true);
        window.setTimeout(() => setPlayerHitAnim(false), 350);
        soundManager.playWrong();
        setBattleLog(
          `GOLEM COUNTER-STRIKE! -${bossDmg} Energy! Correct: ${q.options[check.correctIndex]}`
        );
      }

      window.setTimeout(() => {
        if (nextBossHp <= 0) {
          void finishBattle('victory', nextAnswers);
        } else if (nextEnergy <= 0) {
          void finishBattle('defeat', nextAnswers);
        } else if (idx + 1 >= questions.length) {
          void finishBattle(nextBossHp <= 40 ? 'victory' : 'defeat', nextAnswers);
        } else {
          setIdx((i) => i + 1);
          setLocked(false);
          qStartRef.current = Date.now();
        }
      }, 1150);
    } catch (err) {
      reportError(String(err));
      setLocked(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center font-pixel text-xs text-[#FF6B00]">
        SUMMONING ENTROPY GOLEM...
      </div>
    );
  }

  if (finished) {
    const won = finished === 'victory';
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div
          className={`pixel-panel p-8 text-center ${
            won ? 'border-[#22FF66]' : 'border-[#FF6B00]'
          }`}
        >
          {won ? (
            <Swords size={48} className="mx-auto text-[#FFE600] mb-4" />
          ) : (
            <Skull size={48} className="mx-auto text-[#FF6B00] mb-4" />
          )}
          <h2
            className={`font-pixel text-xl sm:text-2xl mb-3 ${
              won ? 'text-[#22FF66]' : 'text-[#FF6B00]'
            }`}
          >
            {won ? 'BOSS DEFEATED!' : 'SYSTEM OVERLOADED!'}
          </h2>
          <p className="text-base text-[var(--text-secondary)] mb-4">
            {won
              ? 'You shattered the Entropy Golem’s logic core and saved the arcade!'
              : funnyDefeat}
          </p>
          {result && (
            <div className="bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] p-4 mb-6 font-code text-sm">
              SCORE: <strong className="text-[#FFE600]">{result.score}</strong> · HITS:{' '}
              {result.correctCount}/{questions.length} · +{result.xpEarned} XP
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                void startBossFight();
              }}
              className="pixel-btn pixel-btn-orange px-5 py-3 text-xs"
            >
              <RotateCcw size={14} /> Rematch Boss
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onExit();
              }}
              className="pixel-btn pixel-btn-ghost px-5 py-3 text-xs"
            >
              Arcade Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const isBonus = idx === 2 || idx === 5;

  return (
    <div className={`max-w-4xl mx-auto px-4 py-6 ${playerHitAnim && !reducedMotion ? 'animate-pixel-shake' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="pixel-btn pixel-btn-ghost px-3 py-2 text-[10px]"
        >
          <ArrowLeft size={14} /> Retreat
        </button>
        <div className="font-code text-xs sm:text-sm text-[#FFE600] tabular-nums">
          ROUND {idx + 1}/{questions.length} {isBonus ? '· 2x LIGHTNING BONUS!' : ''}
        </div>
      </div>

      {/* Boss & Player Battle Stage */}
      <div className="grid md:grid-cols-[240px_1fr] gap-5 mb-5 items-stretch">
        <div
          className={`pixel-panel p-4 flex flex-col items-center justify-center bg-[#04060E] ${
            bossHitAnim && !reducedMotion ? 'animate-pixel-shake border-[#FFE600]' : 'border-[#A855F7]'
          }`}
        >
          <div className="w-36 h-36 bg-white border-3 border-[#A855F7] overflow-hidden mb-3">
            <img
              src={BOSS_PORTRAIT}
              alt="Entropy Golem Boss Sprite"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain pixelated"
            />
          </div>
          <div className="font-pixel text-[10px] text-[#A855F7] text-center">ENTROPY GOLEM</div>
        </div>

        <div className="pixel-panel p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            {/* Boss HP */}
            <div>
              <div className="flex justify-between font-pixel text-[10px] mb-1.5">
                <span className="text-[#FF6B00] flex items-center gap-1">
                  <Shield size={13} /> BOSS HP
                </span>
                <span className="font-code text-xs text-white tabular-nums">{bossHp}/100</span>
              </div>
              <div className="h-4 bg-[#04060E] border-2 border-[#FF6B00]">
                <div
                  className="h-full bg-[#FF6B00] transition-all duration-200"
                  style={{ width: `${bossHp}%` }}
                />
              </div>
            </div>

            {/* Player Energy */}
            <div>
              <div className="flex justify-between font-pixel text-[10px] mb-1.5">
                <span className="text-[#22FF66] flex items-center gap-1">
                  <Heart size={13} /> YOUR ENERGY
                </span>
                <span className="font-code text-xs text-white tabular-nums">{playerEnergy}/100</span>
              </div>
              <div className="h-4 bg-[#04060E] border-2 border-[#22FF66]">
                <div
                  className="h-full bg-[#22FF66] transition-all duration-200"
                  style={{ width: `${playerEnergy}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-deep)] border-2 border-[var(--border-pixel)] p-3 text-xs sm:text-sm font-code text-[#00F0FF]">
            {battleLog}
          </div>
        </div>
      </div>

      {/* Attack Question */}
      <div
        className={`pixel-panel p-5 sm:p-6 ${
          isBonus ? 'border-[#FFE600]' : 'border-[var(--border-pixel)]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-pixel text-[10px] text-[#00F0FF] flex items-center gap-1.5">
            {isBonus ? (
              <>
                <Zap size={14} className="text-[#FFE600]" /> 2X BONUS STRIKE
              </>
            ) : (
              <>
                <Flame size={14} /> ATTACK PROMPT ({q.difficulty})
              </>
            )}
          </span>
          <span className="font-code text-xs text-[#FFE600]">COMBO {streak}x</span>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-5">
          {q.question}
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => void handleStrike(i)}
              className="p-3.5 bg-[var(--bg-deep)] border-3 border-[var(--border-pixel)] hover:border-[#FFE600] text-left text-sm sm:text-base font-medium cursor-pointer transition-colors min-h-[52px]"
            >
              <span className="font-pixel text-[10px] text-[#FFE600] mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
