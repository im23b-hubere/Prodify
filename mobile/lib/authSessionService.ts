import AsyncStorage from "@react-native-async-storage/async-storage";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";
import { apiJson } from "./client";
import { clearTokenPair } from "./authTokenStorage";
import {
  clearEntitlementCache,
  clearEntitlementCacheForUser,
  seedEntitlementCache,
  syncEntitlement,
} from "./billing";
import { clearDevBillingBypass } from "./devBillingBypass";
import { clearNotificationInbox, setNotificationUserContext } from "./notificationInbox";
import { clearPendingDeepLinkPath } from "./pendingDeepLink";
import { clearLevelCatalogCache } from "./progressionLevelCatalog";
import { clearProgressionSyncCache } from "./progressionSync";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isPremiumActive,
} from "./revenuecat";
import { cancelWeeklyRecapScheduled } from "./weeklyRecapNotifications";

export type AuthenticatedUser = {
  id: number;
  email: string;
  username: string;
  profile_picture_url?: string | null;
  is_premium?: boolean;
  created_at?: string;
};

export type TokenPair = { access_token: string; refresh_token: string };

type AuthenticateOptions = {
  path: "/auth/login" | "/auth/register";
  body: Record<string, string>;
  timeoutMs: number;
  identityTimeoutMs: number;
  retries: number;
  unexpectedResponseMessage: string;
};

export async function authenticate(options: AuthenticateOptions) {
  const response = await apiJson<Partial<TokenPair>>(options.path, {
    method: "POST",
    body: options.body,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });
  const pair = normalizeTokenPair(response);
  if (!pair) throw new Error(options.unexpectedResponseMessage);

  const user = await apiJson<AuthenticatedUser>("/auth/me", {
    token: pair.access_token,
    timeoutMs: options.identityTimeoutMs,
  });
  return { pair, user };
}

export function syncBillingInBackground(accessToken: string, user: AuthenticatedUser): void {
  if (user.is_premium) {
    seedEntitlementCache(
      accessToken,
      { provider: "server", entitlement: "premium", trial_active: false, expires_at: null },
      user.id,
    );
  }

  void (async () => {
    try {
      await configureRevenueCat(String(user.id));
      const customerInfo = await getRevenueCatCustomerInfo(String(user.id));
      const premium = isPremiumActive(customerInfo);
      const synced = await syncEntitlement(accessToken, {
        app_user_id: String(user.id),
        entitlement: premium ? "premium" : "free",
        trial_active: false,
        expires_at: activeEntitlementExpiration(customerInfo),
      }).catch(() => null);
      if (premium && synced) seedEntitlementCache(accessToken, synced, user.id);
    } catch {
      // Billing is best effort; entitlement-aware screens resolve access independently.
    }
  })();
}

export async function clearLocalAuthSession(
  previousUserId: number | undefined,
  clearOnboarding: boolean,
): Promise<void> {
  await clearTokenPair();
  if (clearOnboarding) {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY).catch(() => undefined);
  }
  await clearNotificationInbox().catch(() => undefined);
  await cancelWeeklyRecapScheduled().catch(() => undefined);
  await setNotificationUserContext(null).catch(() => undefined);
  await clearPendingDeepLinkPath();
  await clearDevBillingBypass();
  await configureRevenueCat(undefined).catch(() => undefined);
  clearEntitlementCache();
  if (previousUserId != null) {
    await clearEntitlementCacheForUser(previousUserId).catch(() => undefined);
  }
  clearProgressionSyncCache();
  clearLevelCatalogCache();
}

function normalizeTokenPair(response: Partial<TokenPair>): TokenPair | null {
  const accessToken = typeof response.access_token === "string" ? response.access_token.trim() : "";
  const refreshToken =
    typeof response.refresh_token === "string" ? response.refresh_token.trim() : "";
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}
