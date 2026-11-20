import type { CreationType, PlayerProfile, SavedCreation } from '../../shared/types.ts';
import { safeFetchJson } from './apiClient.ts';

const CREATIONS_CACHE_KEY = 'cgquiz_creations_v1';

function readLocalCache(userId?: string): SavedCreation[] {
  try {
    const raw = localStorage.getItem(CREATIONS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCreation[];
    if (!Array.isArray(parsed)) return [];
    return userId ? parsed.filter((c) => c.userId === userId) : parsed;
  } catch {
    return [];
  }
}

function writeLocalCache(items: SavedCreation[]): void {
  try {
    localStorage.setItem(CREATIONS_CACHE_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    // ignore storage quota errors
  }
}

export function getGuestOrUserId(playerId?: string | null): string {
  if (playerId && playerId.trim()) return playerId.trim();
  const key = 'cgquiz_studio_guest_id';
  let existing = localStorage.getItem(key);
  if (!existing) {
    existing = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      localStorage.setItem(key, existing);
    } catch {
      // ignore
    }
  }
  return existing;
}

export async function listCreations(userId: string, type: 'all' | CreationType = 'all'): Promise<SavedCreation[]> {
  const local = readLocalCache(userId).filter((c) => type === 'all' || c.type === type);
  const res = await safeFetchJson<{ creations?: SavedCreation[] }>(
    `/api/creations?userId=${encodeURIComponent(userId)}&type=${encodeURIComponent(type)}`
  );
  if (res.ok && res.data?.creations) {
    // Merge server & local cache (preferring newest updatedAt)
    const map = new Map<string, SavedCreation>();
    for (const item of local) map.set(item.id, item);
    for (const item of res.data.creations) map.set(item.id, item);
    const merged = [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (type === 'all') {
      const allOthers = readLocalCache().filter((c) => c.userId !== userId);
      writeLocalCache([...merged, ...allOthers]);
    }
    return merged.filter((c) => type === 'all' || c.type === type);
  }
  return local;
}

export async function saveCreation(input: {
  id?: string;
  userId: string;
  type: CreationType;
  title: string;
  subtitle: string;
  designRating: number;
  estimatedCost: number;
  payload: Record<string, unknown>;
  previewDataUrl?: string | null;
}): Promise<{
  creation: SavedCreation;
  xpEarned: number;
  leveledUp: boolean;
  unlockedAchievements: string[];
  player: PlayerProfile | null;
}> {
  const res = await safeFetchJson<{
    creation: SavedCreation;
    xpEarned: number;
    leveledUp: boolean;
    unlockedAchievements: string[];
    player: PlayerProfile | null;
  }>('/api/creations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const now = new Date().toISOString();
  const creation: SavedCreation = res.ok && res.data?.creation
    ? res.data.creation
    : {
        id: input.id || `cr_local_${input.type}_${Date.now()}`,
        userId: input.userId,
        type: input.type,
        title: input.title,
        subtitle: input.subtitle,
        designRating: input.designRating,
        estimatedCost: input.estimatedCost,
        payload: input.payload,
        previewDataUrl: input.previewDataUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };

  const existingAll = readLocalCache().filter((c) => c.id !== creation.id);
  writeLocalCache([creation, ...existingAll]);

  return {
    creation,
    xpEarned: res.data?.xpEarned ?? 50,
    leveledUp: Boolean(res.data?.leveledUp),
    unlockedAchievements: res.data?.unlockedAchievements ?? [],
    player: res.data?.player ?? null,
  };
}

export async function removeCreation(id: string, userId: string): Promise<void> {
  const remaining = readLocalCache().filter((c) => !(c.id === id && c.userId === userId));
  writeLocalCache(remaining);
  await safeFetchJson(`/api/creations/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function submitEasyQuizCompletion(input: {
  userId?: string | null;
  categoryId: string;
  difficulty: string;
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
}): Promise<{
  xpEarned: number;
  leveledUp: boolean;
  unlockedAchievements: string[];
  player: PlayerProfile | null;
}> {
  const res = await safeFetchJson<{
    xpEarned: number;
    leveledUp: boolean;
    unlockedAchievements: string[];
    player: PlayerProfile | null;
  }>('/api/studio/easy-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return {
    xpEarned: res.data?.xpEarned ?? Math.max(15, input.correctCount * 12),
    leveledUp: Boolean(res.data?.leveledUp),
    unlockedAchievements: res.data?.unlockedAchievements ?? [],
    player: res.data?.player ?? null,
  };
}
