import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import type { CustomerInfo } from "react-native-purchases";

import { useAuth } from "../../context/AuthContext";
import { seedEntitlementCache, syncEntitlement } from "../../lib/billing";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import type { PaywallSource } from "../../lib/postAuthNavigation";
import { activeEntitlementExpiration } from "../../lib/revenuecat";
import { usePaywallAccountActions } from "./usePaywallAccountActions";
import { usePaywallCopy } from "./usePaywallCopy";
import { usePaywallExit } from "./usePaywallExit";
import { usePaywallOfferings } from "./usePaywallOfferings";
import { usePaywallPurchases } from "./usePaywallPurchases";

export function usePaywallController() {
  const { token, user, signOut, deleteAccount, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ variant?: string; source?: string }>();
  const source: PaywallSource =
    params.source === "onboarding" || params.source === "post_auth" ? params.source : "in_app";
  const { requestExit, requestExitAfterUnlock, resolveExitAfterUnlock } = usePaywallExit(
    source,
    Boolean(token),
  );

  const { copy, previewWeeklyPrice, previewSixMonthPrice } = usePaywallCopy(source, params.variant);
  const e2ePreviewMode = isE2eModeEnabled();
  const isExpoGo = Constants.appOwnership === "expo";
  /** Dev + Expo Go only: screenshot-friendly layout (no IAP). Never active in release builds. */
  const expoGoPreviewMode = e2ePreviewMode || (__DEV__ && isExpoGo);

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

  const exitToLogin = useCallback(() => requestExit("login"), [requestExit]);
  const { confirmLogout, confirmDeleteAccount } = usePaywallAccountActions({
    signOut,
    deleteAccount,
    exitToLogin,
  });

  const finalizePremiumUnlock = useCallback(
    async (info: CustomerInfo | null, expiresAt?: string | null, showConfirmation = false) => {
      const resolvedExpires = info ? activeEntitlementExpiration(info) : (expiresAt ?? null);
      if (token) {
        seedEntitlementCache(
          token,
          {
            provider: "revenuecat",
            entitlement: "premium",
            trial_active: false,
            expires_at: resolvedExpires,
          },
          appUserId ? Number.parseInt(appUserId, 10) : null,
        );
      }
      if (token && appUserId) {
        const synced = await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: "premium",
          trial_active: false,
          expires_at: resolvedExpires,
        }).catch(() => null);
        if (!synced || synced.entitlement !== "premium") {
          seedEntitlementCache(
            token,
            {
              provider: "revenuecat",
              entitlement: "premium",
              trial_active: false,
              expires_at: resolvedExpires,
            },
            Number.parseInt(appUserId, 10),
          );
        }
        await refreshUser().catch(() => undefined);
      }
      requestExitAfterUnlock(showConfirmation);
    },
    [appUserId, refreshUser, requestExitAfterUnlock, token],
  );
  const {
    loading,
    weeklyPackage: weeklyPkg,
    sixMonthPackage: sixMonthPkg,
    error,
    purchaseEnabled,
    retry,
  } = usePaywallOfferings({
    token,
    appUserId,
    userIsPremium: Boolean(user?.is_premium),
    previewMode: expoGoPreviewMode,
    onPremiumUnlock: finalizePremiumUnlock,
  });

  const {
    busy,
    purchasePackage,
    restore: onRestore,
    skipSubscriptionForDev: onSkipSubscriptionForDev,
  } = usePaywallPurchases({
    token,
    appUserId,
    previewMode: expoGoPreviewMode,
    finalizeUnlock: finalizePremiumUnlock,
    refreshUser,
    requestExit,
    resolveExitAfterUnlock,
  });

  return {
    copy,
    loading,
    busy,
    weeklyPkg,
    sixMonthPkg,
    error,
    purchaseEnabled,
    expoGoPreviewMode,
    previewWeeklyPrice,
    previewSixMonthPrice,
    retry,
    purchasePackage,
    onRestore,
    onSkipSubscriptionForDev,
    confirmLogout,
    confirmDeleteAccount,
  };
}
