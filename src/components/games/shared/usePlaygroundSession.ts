import { useCallback, useEffect, useRef, useState } from 'react';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';
import type { PlaygroundResultPayload } from '../../../../shared/types.ts';
import {
  startPlaygroundSession,
  submitPlaygroundScore,
  type PlaygroundSessionInfo,
} from '../../../utils/playgroundClient.ts';

export function usePlaygroundSession(gameId: string) {
  const { player, updateLocalPlayer, triggerCelebration, setMusicMode } = useArcade();
  const [session, setSession] = useState<PlaygroundSessionInfo | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PlaygroundResultPayload | null>(null);
  const [rankUnavailable, setRankUnavailable] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const startedPerfRef = useRef<number>(performance.now());
  const pausedTotalMsRef = useRef<number>(0);
  const pauseStartedRef = useRef<number | null>(null);
  const submittedRef = useRef<boolean>(false);

  const initSession = useCallback(async () => {
    submittedRef.current = false;
    setResult(null);
    setRankUnavailable(false);
    setStatusNote(null);
    setIsPaused(false);
    setElapsedSeconds(0);
    startedPerfRef.current = performance.now();
    pausedTotalMsRef.current = 0;
    pauseStartedRef.current = null;
    const info = await startPlaygroundSession(gameId, player);
    setSession(info);
  }, [gameId, player]);

  useEffect(() => {
    setMusicMode('gameplay');
    void initSession();
    return () => {
      setMusicMode('home');
    };
  }, [initSession, setMusicMode]);

  useEffect(() => {
    if (isPaused) {
      pauseStartedRef.current = performance.now();
    } else if (pauseStartedRef.current !== null) {
      pausedTotalMsRef.current += performance.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
  }, [isPaused]);

  useEffect(() => {
    if (isPaused || result) return;
    const timer = window.setInterval(() => {
      const elapsedMs = performance.now() - startedPerfRef.current - pausedTotalMsRef.current;
      setElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPaused, result]);

  const finishRun = useCallback(
    async (opts: {
      score: number;
      rawMetric?: number;
      accuracy: number;
      won?: boolean;
      completionTimeMs?: number;
      meta?: Record<string, unknown>;
    }) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      const activePaused =
        pauseStartedRef.current !== null ? performance.now() - pauseStartedRef.current : 0;
      const elapsedMs =
        opts.completionTimeMs ??
        Math.max(
          1500,
          Math.round(performance.now() - startedPerfRef.current - pausedTotalMsRef.current - activePaused)
        );

      const res = await submitPlaygroundScore({
        session,
        gameId,
        player,
        score: opts.score,
        rawMetric: opts.rawMetric,
        completionTimeMs: elapsedMs,
        accuracy: opts.accuracy,
        won: opts.won,
        meta: opts.meta,
        onUpdatePlayer: updateLocalPlayer,
      });

      setRankUnavailable(res.rankUnavailable);
      setStatusNote(res.error || null);
      setResult(res.payload);
      setSubmitting(false);

      if (res.payload.won) {
        arcadeAudio.playSfx('victory');
      }
      if (res.payload.isPersonalBest) {
        triggerCelebration('NEW PERSONAL BEST!', `${res.payload.score.toLocaleString()} PTS`, '#F59E0B');
      } else if (res.payload.leveledUp && res.payload.player) {
        arcadeAudio.playSfx('levelUp');
        triggerCelebration(
          `LEVEL ${res.payload.player.level}!`,
          res.payload.player.title,
          '#22D3EE'
        );
      }
    },
    [gameId, player, session, triggerCelebration, updateLocalPlayer]
  );

  return {
    session,
    isPaused,
    setIsPaused,
    togglePause: () => setIsPaused((p) => !p),
    elapsedSeconds,
    submitting,
    result,
    rankUnavailable,
    statusNote,
    restartSession: initSession,
    finishRun,
  };
}
