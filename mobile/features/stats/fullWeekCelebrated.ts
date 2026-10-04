import AsyncStorage from "@react-native-async-storage/async-storage";

function storageKey(userId: number) {
  return `prodify_full_week_celebrated_v1_${userId}`;
}

export async function loadCelebratedFullWeek(userId: number): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveCelebratedFullWeek(userId: number, weekStart: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), weekStart).catch(() => undefined);
}
