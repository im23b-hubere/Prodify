import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";

import { useAuth } from "../../context/AuthContext";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import type { PaywallSource } from "../../lib/postAuthNavigation";
import { usePaywallAccountActions } from "./usePaywallAccountActions";
import { usePaywallCopy } from "./usePaywallCopy";
import { usePaywallExit } from "./usePaywallExit";
import { usePaywallOfferings } from "./usePaywallOfferings";
import { usePaywallPurchases } from "./usePaywallPurchases";
import { usePremiumUnlockFinalizer } from "./usePremiumUnlockFinalizer";

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

  const finalizePremiumUnlock = usePremiumUnlockFinalizer({
    token,
    appUserId,
    refreshUser,
    requestExitAfterUnlock,
  });
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

export type PaywallController = ReturnType<typeof usePaywallController>;
