import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
} from "react-native-purchases";

let configuredForUser: string | null = null;

function getRevenueCatApiKey(): string {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();
  if (!key) {
    throw new Error("EXPO_PUBLIC_REVENUECAT_API_KEY is missing.");
  }
  return key;
}

function configuredEntitlementId(): string {
  const raw = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim();
  if (!raw) return "premium";
  return raw;
}

export async function configureRevenueCat(appUserId: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  if (configuredForUser === appUserId) return;
  await Purchases.configure({ apiKey: getRevenueCatApiKey(), appUserID: appUserId });
  configuredForUser = appUserId;
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (Platform.OS === "web") return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export function getActiveEntitlement(info: CustomerInfo): PurchasesEntitlementInfo | null {
  const configured = configuredEntitlementId();
  const exact = info.entitlements.active[configured];
  if (exact) return exact;

  // Fallback for projects that used a display/identifier like "Prodify Premium".
  const entries = Object.entries(info.entitlements.active);
  const normalizedTarget = configured.toLowerCase().replace(/\s+/g, "");
  for (const [identifier, ent] of entries) {
    const norm = identifier.toLowerCase().replace(/\s+/g, "");
    if (norm === normalizedTarget || norm.includes("premium")) {
      return ent;
    }
  }
  return null;
}

export function isPremiumActive(info: CustomerInfo): boolean {
  return Boolean(getActiveEntitlement(info));
}

export function isTrialActive(info: CustomerInfo): boolean {
  const ent = getActiveEntitlement(info);
  if (!ent) return false;
  return ent.periodType === "trial";
}

export function activeEntitlementExpiration(info: CustomerInfo): string | null {
  const ent = getActiveEntitlement(info);
  return ent?.expirationDate ?? null;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}
