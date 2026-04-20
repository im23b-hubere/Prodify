import * as SecureStore from "expo-secure-store";

export type MomentumAction = "session" | "checkin" | "social" | "challenge" | "rescue";
export type MomentumState = "low" | "mid" | "high";

type MomentumBlob = {
  score: number;
  last_action: MomentumAction | null;
  updated_at_ms: number;
};

function sanitizeUserId(userId: number): string | null {
  const raw = String(userId).trim();
  const safe = raw.replace(/[^A-Za-z0-9._-]/g, "");
  return safe.length > 0 ? safe : null;
}

function keyFor(userId: number): string | null {
  // Expo SecureStore keys allow only [A-Za-z0-9._-].
  const safeUserId = sanitizeUserId(userId);
  if (!safeUserId) return null;
  return `retention_momentum_${safeUserId}`;
}

function clampScore(v: number): number {
  if (v < 0) return 0;
  if (v > 12) return 12;
  return v;
}

function decayScore(score: number, updatedAtMs: number): number {
  const hours = Math.max(0, (Date.now() - updatedAtMs) / (1000 * 60 * 60));
  const decay = Math.floor(hours / 6);
  return clampScore(score - decay);
}

export function momentumStateFromScore(score: number): MomentumState {
  if (score < 2) return "low";
  if (score < 5) return "mid";
  return "high";
}

export async function getMomentumSnapshot(userId: number): Promise<{
  score: number;
  state: MomentumState;
  lastAction: MomentumAction | null;
}> {
  const key = keyFor(userId);
  if (!key) {
    return { score: 0, state: "low", lastAction: null };
  }
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(key);
  } catch {
    return { score: 0, state: "low", lastAction: null };
  }
  if (!raw) {
    return { score: 0, state: "low", lastAction: null };
  }
  try {
    const data = JSON.parse(raw) as MomentumBlob;
    const decayed = decayScore(Number(data.score ?? 0), Number(data.updated_at_ms ?? 0));
    return {
      score: decayed,
      state: momentumStateFromScore(decayed),
      lastAction: data.last_action ?? null,
    };
  } catch {
    return { score: 0, state: "low", lastAction: null };
  }
}

export async function recordMomentumAction(
  userId: number,
  action: MomentumAction,
): Promise<{
  score: number;
  state: MomentumState;
}> {
  const prev = await getMomentumSnapshot(userId);
  const nextScore = clampScore(prev.score + 1);
  const next: MomentumBlob = {
    score: nextScore,
    last_action: action,
    updated_at_ms: Date.now(),
  };
  const key = keyFor(userId);
  if (!key) {
    return { score: nextScore, state: momentumStateFromScore(nextScore) };
  }
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(next));
  } catch {
    // Momentum must never break user actions.
  }
  return { score: nextScore, state: momentumStateFromScore(nextScore) };
}
