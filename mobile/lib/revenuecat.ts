import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
} from "react-native-purchases";
import {
  getExpoPublicRevenueCatApiKey,
  getExpoPublicRevenueCatEntitlementId,
} from "../constants/env";

let configuredForUser: string | null = null;

function getRevenueCatApiKey(): string | null {
  const key = getExpoPublicRevenueCatApiKey();
  if (!key) return null;
  return key;
}

function configuredEntitlementId(): string {
  const raw = getExpoPublicRevenueCatEntitlementId();
  if (!raw) return "app_access";
  return raw;
}

export async function configureRevenueCat(appUserId?: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;
  const normalized = appUserId?.trim() ? appUserId.trim() : null;

  if (configuredForUser === normalized) return;
  if (configuredForUser === null) {
    await Purchases.configure({
      apiKey,
      ...(normalized ? { appUserID: normalized } : {}),
    });
    configuredForUser = normalized;
    return;
  }

  if (normalized) {
    await Purchases.logIn(normalized);
    configuredForUser = normalized;
    return;
  }

  await Purchases.logOut();
  configuredForUser = null;
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (Platform.OS === "web") return null;
  if (!getRevenueCatApiKey()) return null;
  const offerings = await Purchases.getOfferings();
  if (offerings.current) return offerings.current;
  const allOfferings = Object.values(offerings.all ?? {});
  return allOfferings[0] ?? null;
}

export function getActiveEntitlement(info: CustomerInfo): PurchasesEntitlementInfo | null {
  const configured = configuredEntitlementId();
  const exact = info.entitlements.active[configured];
  if (exact) return exact;

  // Fallback for projects that used older entitlement identifiers.
  const entries = Object.entries(info.entitlements.active);
  const normalizedTarget = configured.toLowerCase().replace(/\s+/g, "");
  for (const [identifier, ent] of entries) {
    const norm = identifier.toLowerCase().replace(/\s+/g, "");
    if (norm === normalizedTarget || norm.includes("premium") || norm.includes("appaccess")) {
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
  if (!getRevenueCatApiKey()) {
    throw new Error("RevenueCat is not configured for this build.");
  }
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  if (!getRevenueCatApiKey()) {
    throw new Error("RevenueCat is not configured for this build.");
  }
  return Purchases.getCustomerInfo();
}
