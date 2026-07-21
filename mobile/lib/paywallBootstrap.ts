import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import type { TFunction } from "i18next";

import { resolvePaywallPackages } from "./billingProducts";
import { resolveOfferingsLoadError } from "./paywallErrors";
import { resolvePremiumGrant } from "./premiumAccess";
import {
  getPaywallBillingSnapshot,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  restoreRevenueCatPurchases,
} from "./revenuecat";

export type PaywallBootstrapResult =
  | { kind: "premium_unlock"; customerInfo: CustomerInfo | null }
  | {
      kind: "plans_ready";
      weekly: PurchasesPackage | null;
      sixMonth: PurchasesPackage | null;
      purchasable: PurchasesPackage[];
    }
  | { kind: "error"; errorKey: string | null; message: string };

type BootstrapInput = {
  token: string | null;
  appUserId: string | null;
  userIsPremium?: boolean;
  t: TFunction;
};

function mapPackages(offeringPackages: PurchasesPackage[]) {
  const { weekly, sixMonth, purchasable } = resolvePaywallPackages(offeringPackages);
  return { weekly, sixMonth, purchasable };
}

async function tryRecoverExistingSubscription(appUserId: string | null): Promise<CustomerInfo | null> {
  if (!appUserId) return null;

  const existing = await getRevenueCatCustomerInfo(appUserId).catch(() => null);
  if (existing && isPremiumActive(existing)) {
    return existing;
  }

  const restored = await restoreRevenueCatPurchases(appUserId).catch(() => null);
  if (restored && isPremiumActive(restored)) {
    return restored;
  }

  return null;
}

/** Resolve paywall state: premium unlock, purchasable plans, or actionable error. */
export async function bootstrapPaywall(input: BootstrapInput): Promise<PaywallBootstrapResult> {
  const grant = await resolvePremiumGrant(input.token, input.appUserId, input.userIsPremium);
  if (grant?.source === "revenuecat") {
    return { kind: "premium_unlock", customerInfo: grant.customerInfo };
  }
  if (grant?.source === "entitlement") {
    return { kind: "premium_unlock", customerInfo: null };
  }

  const snapshot = await getPaywallBillingSnapshot(input.appUserId ?? undefined);
  if (snapshot.customerInfo && isPremiumActive(snapshot.customerInfo)) {
    return { kind: "premium_unlock", customerInfo: snapshot.customerInfo };
  }

  const offeringPackages = snapshot.offering?.availablePackages ?? [];
  let resolved = mapPackages(offeringPackages);
  if (resolved.purchasable.length > 0) {
    return { kind: "plans_ready", ...resolved };
  }

  const recovered = await tryRecoverExistingSubscription(input.appUserId);
  if (recovered) {
    return { kind: "premium_unlock", customerInfo: recovered };
  }

  if (resolved.weekly || resolved.sixMonth) {
    return { kind: "plans_ready", ...resolved };
  }

  const errorKey = "appleProductsUnavailable";
  return {
    kind: "error",
    errorKey,
    message: input.t(`paywall.errors.${errorKey}`),
  };
}

export function resolveBootstrapErrorMessage(error: unknown, t: TFunction): string {
  const resolved = resolveOfferingsLoadError(error, t("paywall.errors.loadOfferings"));
  if (resolved === "appleProductsUnavailable") {
    return t("paywall.errors.appleProductsUnavailable");
  }
  return resolved;
}
