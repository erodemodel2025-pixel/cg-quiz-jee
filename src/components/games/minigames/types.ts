import type { GameModeId } from '../../../../shared/types.ts';

export interface MiniGameComponentProps {
  onExit: () => void;
  onNextChallenge: (nextGameId: GameModeId) => void;
  onOpenLeaderboard: (gameId: GameModeId) => void;
  onGoHome: () => void;
}
