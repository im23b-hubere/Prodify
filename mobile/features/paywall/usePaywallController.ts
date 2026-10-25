import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import type { PaywallSource } from "../../lib/postAuthNavigation";
import { useProfileAccountActions } from "../profile/hooks/useProfileAccountActions";
import { useEntitlementCacheUnlock } from "./useEntitlementCacheUnlock";
import { usePaywallCopy } from "./usePaywallCopy";
import { usePaywallExit } from "./usePaywallExit";
import { usePaywallOfferings } from "./usePaywallOfferings";
import { usePaywallPurchases } from "./usePaywallPurchases";
import { usePremiumUnlockFinalizer } from "./usePremiumUnlockFinalizer";
import { usePremiumUpdateListener } from "./usePremiumUpdateListener";

export function usePaywallController() {
  const { token, user, refreshUser, signOut, deleteAccount } = useAuth();
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

  // Deleting must stay reachable for someone who never subscribes and so never sees Settings.
  const { confirmDeleteAccount } = useProfileAccountActions({ signOut, deleteAccount });

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

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

  usePremiumUpdateListener({
    enabled: !loading && !busy && !expoGoPreviewMode,
    onPremium: finalizePremiumUnlock,
  });
  useEntitlementCacheUnlock({
    token: token ?? null,
    enabled: !expoGoPreviewMode,
    onPremium: () => requestExitAfterUnlock(false),
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
    canDeleteAccount: Boolean(token),
    confirmDeleteAccount,
  };
}

export type PaywallController = ReturnType<typeof usePaywallController>;
