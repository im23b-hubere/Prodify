import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  getExpoPublicRevenueCatApiKey,
  getExpoPublicRevenueCatEntitlementId,
} from "../constants/env";
import { isE2eModeEnabled } from "./e2eMode";

/** RevenueCat app user id currently associated with the SDK session. */
let configuredForUser: string | null = null;
/** Purchases.configure() may only run once per app process. */
let sdkConfigured = false;
let configureChain: Promise<void> = Promise.resolve();

const REVENUECAT_CONFIGURE_TIMEOUT_MS = 8_000;
const REVENUECAT_READ_TIMEOUT_MS = 8_000;
const REVENUECAT_PURCHASE_TIMEOUT_MS = 45_000;
const OFFERINGS_RETRY_ATTEMPTS = 1;

function withRevenueCatTimeout<T>(
  promise: Promise<T>,
  operation: string,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`RevenueCat ${operation} timed out. Please try again.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

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
  if (isE2eModeEnabled()) {
    return;
  }

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
    .catch(() => undefined)
    .then(async () => {
      if (__DEV__) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      if (!sdkConfigured) {
        await withRevenueCatTimeout(
          Promise.resolve(
            Purchases.configure({
              apiKey,
              ...(normalized ? { appUserID: normalized } : {}),
            }),
          ),
          "configure",
          REVENUECAT_CONFIGURE_TIMEOUT_MS,
        );
        sdkConfigured = true;
        configuredForUser = normalized;
        return;
      }

      if (normalized === configuredForUser) {
        return;
      }

      if (normalized) {
        await withRevenueCatTimeout(
          Purchases.logIn(normalized).then(() => undefined),
          "log in",
          REVENUECAT_CONFIGURE_TIMEOUT_MS,
        );
        configuredForUser = normalized;
        return;
      }

      if (configuredForUser !== null) {
        await withRevenueCatTimeout(Purchases.logOut(), "log out", REVENUECAT_CONFIGURE_TIMEOUT_MS);
        configuredForUser = null;
      }
    });

  await configureChain;
}

async function ensurePurchasesReady(appUserId?: string): Promise<void> {
  await configureRevenueCat(appUserId);
  if (!sdkConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }
}

async function fetchOfferingsWithRetry(appUserId?: string) {
  await ensurePurchasesReady(appUserId);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= OFFERINGS_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await withRevenueCatTimeout(
        Purchases.getOfferings(),
        "offerings",
        REVENUECAT_READ_TIMEOUT_MS,
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("RevenueCat offerings could not be fetched from App Store Connect.");
}

export async function getDefaultOffering(appUserId?: string): Promise<PurchasesOffering | null> {
  if (isE2eModeEnabled()) return null;
  if (Platform.OS === "web") return null;
  if (!getRevenueCatApiKey()) return null;
  const offerings = await fetchOfferingsWithRetry(appUserId);
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
  return withRevenueCatTimeout(
    Purchases.restorePurchases(),
    "restore purchases",
    REVENUECAT_READ_TIMEOUT_MS,
  );
}

export async function getRevenueCatCustomerInfo(appUserId?: string): Promise<CustomerInfo> {
  await ensurePurchasesReady(appUserId);
  return withRevenueCatTimeout(
    Purchases.getCustomerInfo(),
    "customer info",
    REVENUECAT_READ_TIMEOUT_MS,
  );
}

export async function purchaseRevenueCatPackage(
  pkg: PurchasesPackage,
  appUserId?: string,
): Promise<MakePurchaseResult> {
  await ensurePurchasesReady(appUserId);
  return withRevenueCatTimeout(
    Purchases.purchasePackage(pkg),
    "purchase",
    REVENUECAT_PURCHASE_TIMEOUT_MS,
  );
}

export type PaywallBillingSnapshot = {
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
};

/** Load customer info and offerings in parallel after SDK configure. */
export async function getPaywallBillingSnapshot(
  appUserId?: string,
): Promise<PaywallBillingSnapshot> {
  if (isE2eModeEnabled() || Platform.OS === "web" || !getRevenueCatApiKey()) {
    return { customerInfo: null, offering: null };
  }

  await ensurePurchasesReady(appUserId);

  const [customerInfoResult, offeringResult] = await Promise.allSettled([
    getRevenueCatCustomerInfo(appUserId),
    getDefaultOffering(appUserId),
  ]);

  return {
    customerInfo: customerInfoResult.status === "fulfilled" ? customerInfoResult.value : null,
    offering: offeringResult.status === "fulfilled" ? offeringResult.value : null,
  };
}
