import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
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

function isRevenueCatRuntimeAvailable(): boolean {
  if (isE2eModeEnabled()) return false;
  if (Platform.OS === "web") return false;
  // Expo Go has no StoreKit/Play Billing; the SDK logs Browser Mode but cannot purchase.
  if (Constants.appOwnership === "expo") return false;
  return Boolean(getRevenueCatApiKey());
}

/** Configure RevenueCat once, then logIn/logOut when the app user changes. */
export async function configureRevenueCat(appUserId?: string): Promise<void> {
  if (!isRevenueCatRuntimeAvailable()) return;
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

function readSdkAppUserId(): Promise<string> {
  return withRevenueCatTimeout(
    Purchases.getAppUserID(),
    "app user id",
    REVENUECAT_READ_TIMEOUT_MS,
  );
}

/**
 * Customer state, purchases and restores belong to one account. The SDK can lag behind a
 * sign-in (failed logIn, anonymous session), so verify its identity and re-login once before
 * acting; otherwise a subscriber would see an empty account or a purchase would land elsewhere.
 */
async function ensureSignedInAs(appUserId?: string): Promise<void> {
  await ensurePurchasesReady(appUserId);
  const expected = normalizeAppUserId(appUserId);
  if (!expected) return;
  if ((await readSdkAppUserId()) === expected) return;

  await withRevenueCatTimeout(
    Purchases.logIn(expected).then(() => undefined),
    "log in",
    REVENUECAT_CONFIGURE_TIMEOUT_MS,
  );
  configuredForUser = expected;
  if ((await readSdkAppUserId()) !== expected) {
    throw new Error("RevenueCat is signed in as a different account. Please try again.");
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
  if (!isRevenueCatRuntimeAvailable()) return null;
  const offerings = await fetchOfferingsWithRetry(appUserId);
  if (offerings.current) return offerings.current;
  const allOfferings = Object.values(offerings.all ?? {});
  return allOfferings[0] ?? null;
}

/** Exact match only: the backend checks the same identifier, so app and server never disagree. */
export function getActiveEntitlement(info: CustomerInfo): PurchasesEntitlementInfo | null {
  return info.entitlements.active[configuredEntitlementId()] ?? null;
}

export function isPremiumActive(info: CustomerInfo): boolean {
  return Boolean(getActiveEntitlement(info));
}

export function activeEntitlementExpiration(info: CustomerInfo): string | null {
  const ent = getActiveEntitlement(info);
  return ent?.expirationDate ?? null;
}

export async function restoreRevenueCatPurchases(appUserId?: string): Promise<CustomerInfo> {
  await ensureSignedInAs(appUserId);
  return withRevenueCatTimeout(
    Purchases.restorePurchases(),
    "restore purchases",
    REVENUECAT_READ_TIMEOUT_MS,
  );
}

export async function getRevenueCatCustomerInfo(appUserId?: string): Promise<CustomerInfo> {
  await ensureSignedInAs(appUserId);
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
  await ensureSignedInAs(appUserId);
  return withRevenueCatTimeout(
    Purchases.purchasePackage(pkg),
    "purchase",
    REVENUECAT_PURCHASE_TIMEOUT_MS,
  );
}

const STORE_SUBSCRIPTIONS_URL = Platform.select({
  android: "https://play.google.com/store/account/subscriptions",
  default: "https://apps.apple.com/account/subscriptions",
});

/**
 * Lets a subscriber change or cancel the plan without leaving the app: the store's own sheet,
 * or its subscriptions page where the sheet is unavailable (Expo Go, SDK not configured).
 */
export async function openSubscriptionManagement(): Promise<void> {
  if (sdkConfigured) {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Fall through to the store's subscriptions page.
    }
  }
  await Linking.openURL(STORE_SUBSCRIPTIONS_URL).catch(() => undefined);
}

/** Listen for SDK-pushed customer changes (renewals, purchases finished elsewhere). */
export function subscribeToCustomerInfoUpdates(
  onUpdate: (info: CustomerInfo) => void,
): () => void {
  if (!sdkConfigured) return () => undefined;
  const listener = (info: CustomerInfo) => onUpdate(info);
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export type PaywallBillingSnapshot = {
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
};

/** Load customer info and offerings in parallel; either may fail without hiding the other. */
export async function getPaywallBillingSnapshot(
  appUserId?: string,
): Promise<PaywallBillingSnapshot> {
  if (!isRevenueCatRuntimeAvailable()) {
    return { customerInfo: null, offering: null };
  }

  const [customerInfoResult, offeringResult] = await Promise.allSettled([
    getRevenueCatCustomerInfo(appUserId),
    getDefaultOffering(appUserId),
  ]);

  return {
    customerInfo: customerInfoResult.status === "fulfilled" ? customerInfoResult.value : null,
    offering: offeringResult.status === "fulfilled" ? offeringResult.value : null,
  };
}
