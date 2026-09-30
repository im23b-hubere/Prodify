import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSkillFocusId, type SkillFocusId } from "../../constants/skills";

function storageKey(userId: number) {
  return `prodify_skill_tree_seen_v1_${userId}`;
}

export async function loadSeenUnlockedSkills(userId: number): Promise<Set<SkillFocusId>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(isSkillFocusId) : []);
  } catch {
    return new Set();
  }
}

export async function saveSeenUnlockedSkills(userId: number, ids: SkillFocusId[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(ids)).catch(() => undefined);
}
