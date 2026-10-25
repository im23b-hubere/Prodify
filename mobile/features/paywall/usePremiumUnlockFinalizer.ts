import { useCallback } from "react";
import type { CustomerInfo } from "react-native-purchases";

import { hasPremiumAccess, seedEntitlementCache, syncEntitlement } from "../../lib/billing";
import { activeEntitlementExpiration } from "../../lib/revenuecat";

type Options = {
  token: string | null;
  appUserId: string | null;
  refreshUser: () => Promise<unknown>;
  requestExitAfterUnlock: (showConfirmation?: boolean) => void;
};

function premiumEntitlement(expiresAt: string | null) {
  return {
    provider: "revenuecat" as const,
    entitlement: "premium" as const,
    trial_active: false,
    expires_at: expiresAt,
  };
}

/**
 * Open the app once the server agrees, since every product route checks the subscription there.
 * Returns false when the server's RevenueCat check denies access: leaving would only bounce the
 * producer back through a 402.
 */
export async function finalizePremiumUnlock(
  options: Options & {
    info: CustomerInfo | null;
    expiresAt?: string | null;
    showConfirmation?: boolean;
  },
): Promise<boolean> {
  const { token, appUserId, refreshUser, requestExitAfterUnlock, info } = options;
  const expiresAt = info ? activeEntitlementExpiration(info) : (options.expiresAt ?? null);
  const entitlement = premiumEntitlement(expiresAt);
  const numericUserId = appUserId ? Number.parseInt(appUserId, 10) : null;
  if (token && appUserId) {
    const synced = await syncEntitlement(token, {
      app_user_id: appUserId,
      entitlement: "premium",
      trial_active: false,
      expires_at: expiresAt,
    }).catch(() => null);
    if (synced && !hasPremiumAccess(synced)) return false;
    // Unreachable server: keep the store's answer so a paying producer is not locked out.
    if (!synced) seedEntitlementCache(token, entitlement, numericUserId);
    await refreshUser().catch(() => undefined);
  } else if (token) {
    seedEntitlementCache(token, entitlement, numericUserId);
  }
  requestExitAfterUnlock(options.showConfirmation ?? false);
  return true;
}

export function usePremiumUnlockFinalizer(options: Options) {
  const { token, appUserId, refreshUser, requestExitAfterUnlock } = options;
  return useCallback(
    (info: CustomerInfo | null, expiresAt?: string | null, showConfirmation = false) =>
      finalizePremiumUnlock({
        token,
        appUserId,
        refreshUser,
        requestExitAfterUnlock,
        info,
        expiresAt,
        showConfirmation,
      }),
    [appUserId, refreshUser, requestExitAfterUnlock, token],
  );
}
