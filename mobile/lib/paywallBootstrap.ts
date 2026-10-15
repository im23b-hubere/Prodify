import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import type { TFunction } from "i18next";

import { resolvePaywallPackages } from "./billingProducts";
import { resolvePremiumGrant } from "./premiumAccess";
import { getPaywallBillingSnapshot, getRevenueCatCustomerInfo, isPremiumActive } from "./revenuecat";

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

/**
 * Offering plans to a subscriber is the bug we must never ship, so an unreadable customer state
 * gets one more read. Restoring is deliberately left to the user: it can prompt for the store
 * account and may move purchases between app accounts.
 */
async function readCustomerInfoIfUnknown(
  snapshotInfo: CustomerInfo | null,
  appUserId: string | null,
): Promise<CustomerInfo | null> {
  if (snapshotInfo || !appUserId) return snapshotInfo;
  return getRevenueCatCustomerInfo(appUserId).catch(() => null);
}

/** Resolve paywall state: premium unlock, purchasable plans, or actionable error. */
export async function bootstrapPaywall(input: BootstrapInput): Promise<PaywallBootstrapResult> {
  // Entitlement and StoreKit are independent sources. Resolve them together so a slow backend or
  // stale RevenueCat identity cannot leave the paywall showing skeletons for a full minute.
  const [grant, snapshot] = await Promise.all([
    resolvePremiumGrant(input.token, input.appUserId, input.userIsPremium, {
      includeRevenueCat: false,
    }),
    getPaywallBillingSnapshot(input.appUserId ?? undefined),
  ]);
  // The snapshot already carries RevenueCat state; the server grant only checks the backend.
  if (grant?.source === "entitlement") {
    return { kind: "premium_unlock", customerInfo: null };
  }

  const customerInfo = await readCustomerInfoIfUnknown(snapshot.customerInfo, input.appUserId);
  if (customerInfo && isPremiumActive(customerInfo)) {
    return { kind: "premium_unlock", customerInfo };
  }

  const resolved = mapPackages(snapshot.offering?.availablePackages ?? []);
  if (resolved.purchasable.length > 0 || resolved.weekly || resolved.sixMonth) {
    return { kind: "plans_ready", ...resolved };
  }

  const errorKey = "appleProductsUnavailable";
  return {
    kind: "error",
    errorKey,
    message: input.t(`paywall.errors.${errorKey}`),
  };
}
