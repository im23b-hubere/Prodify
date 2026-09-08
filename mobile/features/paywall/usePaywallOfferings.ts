import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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

type OfferingSnapshot = {
  weeklyPackage: PurchasesPackage | null;
  sixMonthPackage: PurchasesPackage | null;
  error: string | null;
  purchaseEnabled: boolean;
};

type OfferingResolution =
  | { kind: "snapshot"; value: OfferingSnapshot }
  | { kind: "premium_unlock"; customerInfo: CustomerInfo | null };

const EMPTY_OFFERINGS: OfferingSnapshot = {
  weeklyPackage: null,
  sixMonthPackage: null,
  error: null,
  purchaseEnabled: false,
};

export function usePaywallOfferings({
  token,
  appUserId,
  userIsPremium,
  previewMode,
  onPremiumUnlock,
}: PaywallOfferingsOptions) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const isExpoGo = Constants.appOwnership === "expo";

  // Everything the request depends on, as one comparable value. Tagging each result with the
  // key it was fetched under makes "still loading" derivable, so the effect never has to set
  // state synchronously just to announce that a new request started.
  const requestKey = JSON.stringify([
    token ?? null,
    appUserId,
    userIsPremium,
    previewMode,
    isExpoGo,
    reloadKey,
  ]);
  const [resolved, setResolved] = useState<{ key: string; offerings: OfferingSnapshot } | null>(
    null,
  );
  const loading = resolved?.key !== requestKey;
  const offerings = resolved?.offerings ?? EMPTY_OFFERINGS;

  useEffect(() => {
    let cancelled = false;
    void resolveOfferings({ token, appUserId, userIsPremium, previewMode, isExpoGo, t })
      .then(async (result) => {
        if (cancelled) return;
        if (result.kind === "premium_unlock") {
          await onPremiumUnlock(result.customerInfo);
          if (!cancelled) setResolved({ key: requestKey, offerings: EMPTY_OFFERINGS });
        } else {
          setResolved({ key: requestKey, offerings: result.value });
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setResolved({
          key: requestKey,
          offerings: {
            ...EMPTY_OFFERINGS,
            error:
              loadError instanceof Error ? loadError.message : t("paywall.errors.loadOfferings"),
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [appUserId, isExpoGo, onPremiumUnlock, previewMode, requestKey, t, token, userIsPremium]);

  return {
    loading,
    ...offerings,
    // A pending request supersedes whatever the previous one reported.
    error: loading ? null : offerings.error,
    retry: () => setReloadKey((current) => current + 1),
  };
}

async function resolveOfferings({
  token,
  appUserId,
  userIsPremium,
  previewMode,
  isExpoGo,
  t,
}: Omit<PaywallOfferingsOptions, "onPremiumUnlock"> & {
  isExpoGo: boolean;
  t: TFunction;
}): Promise<OfferingResolution> {
  if (previewMode) return { kind: "snapshot", value: EMPTY_OFFERINGS };
  if (!getExpoPublicRevenueCatApiKey()) {
    return {
      kind: "snapshot",
      value: { ...EMPTY_OFFERINGS, error: t("paywall.errors.missingConfig") },
    };
  }
  if (isExpoGo) {
    return {
      kind: "snapshot",
      value: { ...EMPTY_OFFERINGS, error: t("paywall.errors.expoGoNotSupported") },
    };
  }
  const result = await bootstrapPaywall({
    token: token ?? null,
    appUserId,
    userIsPremium,
    t,
  });
  if (result.kind === "premium_unlock") return result;
  if (result.kind === "plans_ready") {
    return {
      kind: "snapshot",
      value: {
        weeklyPackage: result.weekly,
        sixMonthPackage: result.sixMonth,
        purchaseEnabled: result.purchasable.length > 0,
        error: null,
      },
    };
  }
  return {
    kind: "snapshot",
    value: { ...EMPTY_OFFERINGS, error: result.message },
  };
}
