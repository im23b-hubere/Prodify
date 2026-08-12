import { useCallback } from "react";
import type { CustomerInfo } from "react-native-purchases";

import { seedEntitlementCache, syncEntitlement } from "../../lib/billing";
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

export async function finalizePremiumUnlock(
  options: Options & {
    info: CustomerInfo | null;
    expiresAt?: string | null;
    showConfirmation?: boolean;
  },
): Promise<void> {
  const { token, appUserId, refreshUser, requestExitAfterUnlock, info } = options;
  const expiresAt = info ? activeEntitlementExpiration(info) : (options.expiresAt ?? null);
  const entitlement = premiumEntitlement(expiresAt);
  const numericUserId = appUserId ? Number.parseInt(appUserId, 10) : null;
  if (token) seedEntitlementCache(token, entitlement, numericUserId);
  if (token && appUserId) {
    const synced = await syncEntitlement(token, {
      app_user_id: appUserId,
      entitlement: "premium",
      trial_active: false,
      expires_at: expiresAt,
    }).catch(() => null);
    if (synced?.entitlement !== "premium") {
      seedEntitlementCache(token, entitlement, numericUserId);
    }
    await refreshUser().catch(() => undefined);
  }
  requestExitAfterUnlock(options.showConfirmation ?? false);
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
