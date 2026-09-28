import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_REMEMBERED = 50;

function storageKey(userId: number) {
  return `prodify_duel_clash_seen_v1_${userId}`;
}

export async function loadSeenDuelClashIds(userId: number): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : []);
  } catch {
    return new Set();
  }
}

export async function markDuelClashSeen(userId: number, challengeId: number): Promise<void> {
  const seen = await loadSeenDuelClashIds(userId);
  if (seen.has(challengeId)) return;
  const next = [...seen, challengeId].slice(-MAX_REMEMBERED);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next)).catch(() => undefined);
}
