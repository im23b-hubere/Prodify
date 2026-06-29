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

/** RevenueCat app user id currently associated with the SDK session. */
let configuredForUser: string | null = null;
/** Purchases.configure() may only run once per app process. */
let sdkConfigured = false;
let configureChain: Promise<void> = Promise.resolve();

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

function normalizeAppUserId(appUserId?: string): string | null {
  const trimmed = appUserId?.trim();
  return trimmed ? trimmed : null;
}

/** Configure RevenueCat once, then logIn/logOut when the app user changes. */
export async function configureRevenueCat(appUserId?: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;

  const normalized = normalizeAppUserId(appUserId);
  if (sdkConfigured && configuredForUser === normalized) {
    return;
  }

  configureChain = configureChain
    .then(async () => {
      if (__DEV__) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      if (!sdkConfigured) {
        await Purchases.configure({
          apiKey,
          ...(normalized ? { appUserID: normalized } : {}),
        });
        sdkConfigured = true;
        configuredForUser = normalized;
        return;
      }

      if (normalized === configuredForUser) {
        return;
      }

      if (normalized) {
        await Purchases.logIn(normalized);
        configuredForUser = normalized;
        return;
      }

      if (configuredForUser !== null) {
        await Purchases.logOut();
        configuredForUser = null;
      }
    })
    .catch((error) => {
      throw error;
    });

  await configureChain;
}

async function ensurePurchasesReady(appUserId?: string): Promise<void> {
  await configureRevenueCat(appUserId);
  if (!sdkConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }
}

export async function getDefaultOffering(appUserId?: string): Promise<PurchasesOffering | null> {
  if (Platform.OS === "web") return null;
  if (!getRevenueCatApiKey()) return null;
  await ensurePurchasesReady(appUserId);
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

export async function restoreRevenueCatPurchases(appUserId?: string): Promise<CustomerInfo> {
  await ensurePurchasesReady(appUserId);
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo(appUserId?: string): Promise<CustomerInfo> {
  await ensurePurchasesReady(appUserId);
  return Purchases.getCustomerInfo();
}
