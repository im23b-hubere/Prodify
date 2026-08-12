import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { seedEntitlementCache, syncEntitlement } from "../../lib/billing";
import { setDevBillingBypass } from "../../lib/devBillingBypass";
import {
  isPaymentPendingError,
  isPurchaseAlreadyOwnedError,
  isPurchaseCancelledError,
} from "../../lib/paywallErrors";
import {
  activeEntitlementExpiration,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../../lib/revenuecat";
import type { PaywallExit } from "./usePaywallExit";

type PaywallPurchasesOptions = {
  token?: string | null;
  appUserId: string | null;
  previewMode: boolean;
  finalizeUnlock: (
    customerInfo: CustomerInfo | null,
    expiresAt?: string | null,
    showConfirmation?: boolean,
  ) => Promise<void>;
  refreshUser: () => Promise<unknown>;
  requestExit: (exit: PaywallExit) => void;
  resolveExitAfterUnlock: () => PaywallExit;
};

export function usePaywallPurchases({
  token,
  appUserId,
  previewMode,
  finalizeUnlock,
  refreshUser,
  requestExit,
  resolveExitAfterUnlock,
}: PaywallPurchasesOptions) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function recoverExistingSubscription(): Promise<boolean> {
    const customerInfo = await getRevenueCatCustomerInfo(appUserId ?? undefined).catch(() => null);
    if (customerInfo && isPremiumActive(customerInfo)) {
      await finalizeUnlock(customerInfo, undefined, true);
      return true;
    }
    const restored = await restoreRevenueCatPurchases(appUserId ?? undefined).catch(() => null);
    if (restored && isPremiumActive(restored)) {
      await finalizeUnlock(restored, undefined, true);
      return true;
    }
    Alert.alert(
      t("paywall.alerts.restoreFailedTitle"),
      t("paywall.errors.alreadySubscribedRestoreFailed"),
    );
    return false;
  }

  async function purchasePackage(pkg: PurchasesPackage | null) {
    if (!pkg) {
      Alert.alert(t("paywall.alerts.unavailableTitle"), t("paywall.alerts.unavailableBody"));
      return;
    }
    setBusy(true);
    try {
      const result = await purchaseRevenueCatPackage(pkg, appUserId ?? undefined);
      if (!isPremiumActive(result.customerInfo)) {
        throw new Error(t("paywall.errors.entitlementNotActive"));
      }
      await finalizeUnlock(result.customerInfo, undefined, true);
    } catch (purchaseError) {
      if (isPurchaseCancelledError(purchaseError)) return;
      if (isPurchaseAlreadyOwnedError(purchaseError) && (await recoverExistingSubscription()))
        return;
      if (isPaymentPendingError(purchaseError)) {
        Alert.alert(
          t("paywall.alerts.purchasePendingTitle"),
          t("paywall.alerts.purchasePendingBody"),
        );
        return;
      }
      Alert.alert(
        t("paywall.alerts.purchaseFailedTitle"),
        purchaseError instanceof Error ? purchaseError.message : t("paywall.errors.purchaseFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      const info = await restoreRevenueCatPurchases(appUserId ?? undefined);
      const premium = isPremiumActive(info);
      if (token && appUserId) {
        await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: premium ? "premium" : "free",
          trial_active: false,
          expires_at: activeEntitlementExpiration(info),
        }).catch(() => undefined);
        if (premium) await refreshUser().catch(() => undefined);
      }
      if (premium) await finalizeUnlock(info, undefined, true);
      else {
        Alert.alert(
          t("paywall.alerts.restoreCompleteTitle"),
          t("paywall.alerts.restoreCompleteNone"),
        );
      }
    } catch (restoreError) {
      Alert.alert(
        t("paywall.alerts.restoreFailedTitle"),
        restoreError instanceof Error ? restoreError.message : t("paywall.errors.restoreFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function skipSubscriptionForDev() {
    if (!previewMode) return;
    setBusy(true);
    try {
      await setDevBillingBypass(true);
      if (token) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30);
        seedEntitlementCache(token, {
          provider: "revenuecat",
          entitlement: "premium",
          trial_active: false,
          expires_at: expiration.toISOString(),
        });
      }
      requestExit(token ? "dashboard" : resolveExitAfterUnlock());
    } finally {
      setBusy(false);
    }
  }

  return { busy, purchasePackage, restore, skipSubscriptionForDev };
}
