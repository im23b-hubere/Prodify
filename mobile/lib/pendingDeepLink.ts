import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";

import { PENDING_DEEP_LINK_PATH_KEY } from "../constants/storageKeys";
import {
  deepLinkRequiresAuth,
  isAllowedDeepLinkPath,
  normalizeIncomingPath,
  toRoutableHref,
} from "./deepLinkGuard";
import { DASHBOARD_TAB_HREF } from "./postAuthNavigation";

type ReplaceFn = (href: Href) => void;

/** Remember a protected route to open after the user signs in (cold-start deep link). */
export async function setPendingDeepLinkPath(targetPath: string): Promise<void> {
  const normalized = normalizeIncomingPath(targetPath);
  if (!normalized) return;
  if (!isAllowedDeepLinkPath(normalized)) return;
  if (!deepLinkRequiresAuth(normalized)) return;
  await AsyncStorage.setItem(PENDING_DEEP_LINK_PATH_KEY, normalized).catch(() => undefined);
}

export async function clearPendingDeepLinkPath(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_DEEP_LINK_PATH_KEY).catch(() => undefined);
}

/**
 * Returns a validated `Href` and clears storage. Returns `null` if nothing stored or invalid.
 */
export async function consumePendingDeepLinkHref(): Promise<Href | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(PENDING_DEEP_LINK_PATH_KEY);
  } catch {
    return null;
  }
  await AsyncStorage.removeItem(PENDING_DEEP_LINK_PATH_KEY).catch(() => undefined);
  if (!raw?.trim()) return null;
  const normalized = normalizeIncomingPath(raw);
  if (!normalized || !isAllowedDeepLinkPath(normalized) || !deepLinkRequiresAuth(normalized)) {
    return null;
  }
  return toRoutableHref(normalized) as Href;
}

/** After login / paywall → home: prefer stored deep link, otherwise `/(tabs)/dashboard`. */
export async function replaceWithPendingDeepLinkOrDashboard(router: {
  replace: ReplaceFn;
}): Promise<void> {
  const pending = await consumePendingDeepLinkHref();
  if (pending) {
    router.replace(pending);
    return;
  }
  router.replace(DASHBOARD_TAB_HREF as Href);
}
