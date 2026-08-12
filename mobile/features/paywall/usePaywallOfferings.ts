import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { getExpoPublicRevenueCatApiKey } from "../../constants/env";
import { bootstrapPaywall } from "../../lib/paywallBootstrap";

type PaywallOfferingsOptions = {
  token?: string | null;
  appUserId: string | null;
  userIsPremium: boolean;
  previewMode: boolean;
  onPremiumUnlock: (customerInfo: CustomerInfo | null) => Promise<void>;
};

export function usePaywallOfferings({
  token,
  appUserId,
  userIsPremium,
  previewMode,
  onPremiumUnlock,
}: PaywallOfferingsOptions) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [weeklyPackage, setWeeklyPackage] = useState<PurchasesPackage | null>(null);
  const [sixMonthPackage, setSixMonthPackage] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isExpoGo = Constants.appOwnership === "expo";

  useEffect(() => {
    let cancelled = false;
    async function loadOfferings() {
      try {
        if (previewMode) {
          setPurchaseEnabled(false);
          setWeeklyPackage(null);
          setSixMonthPackage(null);
          setError(null);
          return;
        }
        setLoading(true);
        setError(null);
        if (!getExpoPublicRevenueCatApiKey()) {
          setPurchaseEnabled(false);
          setError(t("paywall.errors.missingConfig"));
          return;
        }
        if (isExpoGo) {
          setPurchaseEnabled(false);
          setError(t("paywall.errors.expoGoNotSupported"));
          return;
        }

        const result = await bootstrapPaywall({
          token: token ?? null,
          appUserId,
          userIsPremium,
          t,
        });
        if (cancelled) return;
        if (result.kind === "premium_unlock") {
          await onPremiumUnlock(result.customerInfo);
        } else if (result.kind === "plans_ready") {
          setWeeklyPackage(result.weekly);
          setSixMonthPackage(result.sixMonth);
          setPurchaseEnabled(result.purchasable.length > 0);
          setError(null);
        } else {
          setPurchaseEnabled(false);
          setWeeklyPackage(null);
          setSixMonthPackage(null);
          setError(result.message);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPurchaseEnabled(false);
          setError(
            loadError instanceof Error ? loadError.message : t("paywall.errors.loadOfferings"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOfferings();
    return () => {
      cancelled = true;
    };
  }, [appUserId, isExpoGo, onPremiumUnlock, previewMode, reloadKey, t, token, userIsPremium]);

  return {
    loading,
    weeklyPackage,
    sixMonthPackage,
    error,
    purchaseEnabled,
    retry: () => setReloadKey((current) => current + 1),
  };
}
