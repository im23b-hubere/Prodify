import AsyncStorage from "@react-native-async-storage/async-storage";

import { ENTITLEMENT_PERSISTENCE_KEY } from "../constants/storageKeys";
import type { EntitlementDto } from "../types/outcomes";

type StoredEntitlement = {
  userId: number;
  value: EntitlementDto;
  cachedAtMs: number;
};

/** Grace period after `expires_at` before treating premium as stale (clock skew / renewals). */
export const PREMIUM_GRACE_MS = 60 * 60 * 1000;

function userKey(userId: number): string {
  return `${ENTITLEMENT_PERSISTENCE_KEY}_${userId}`;
}

/** True when a stored entitlement still grants premium access. */
export function isPersistedPremiumValid(ent: EntitlementDto, nowMs = Date.now()): boolean {
  if (ent.entitlement !== "premium") return false;
  if (!ent.expires_at) return true;
  const expiresMs = Date.parse(ent.expires_at);
  if (!Number.isFinite(expiresMs)) return true;
  return expiresMs + PREMIUM_GRACE_MS > nowMs;
}

export async function loadPersistedEntitlement(userId: number): Promise<EntitlementDto | null> {
  try {
    const raw = await AsyncStorage.getItem(userKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntitlement;
    if (parsed.userId !== userId || !parsed.value) return null;
    if (!isPersistedPremiumValid(parsed.value)) {
      await AsyncStorage.removeItem(userKey(userId)).catch(() => undefined);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export async function persistEntitlement(userId: number, value: EntitlementDto): Promise<void> {
  if (!isPersistedPremiumValid(value)) {
    await AsyncStorage.removeItem(userKey(userId)).catch(() => undefined);
    return;
  }
  const stored: StoredEntitlement = {
    userId,
    value,
    cachedAtMs: Date.now(),
  };
  await AsyncStorage.setItem(userKey(userId), JSON.stringify(stored));
}

export async function clearPersistedEntitlement(userId: number): Promise<void> {
  await AsyncStorage.removeItem(userKey(userId)).catch(() => undefined);
}
