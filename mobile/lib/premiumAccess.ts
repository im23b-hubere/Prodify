import {
  fetchEntitlement,
  hasPremiumAccess,
  peekCachedHasPremiumAccess,
  seedEntitlementCache,
  syncEntitlement,
} from "./billing";
import { isE2eModeEnabled } from "./e2eMode";
import { isDevBillingBypassActive } from "./devBillingBypass";
import { loadPersistedEntitlement } from "./entitlementStorage";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isPremiumActive,
} from "./revenuecat";
import type { EntitlementDto } from "../types/outcomes";

/** Server entitlement is authoritative and usually fast; keep RC as a short secondary probe. */
const SERVER_CHECK_TIMEOUT_MS = 4_000;
const REVENUECAT_PROBE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

/** Resolve whether the user may access subscription-gated tabs (RevenueCat + server). */
export async function resolvePremiumAccess(
  token: string,
  appUserId?: string | null,
): Promise<boolean> {
  if (isE2eModeEnabled()) {
    return true;
  }

  if (await isDevBillingBypassActive()) {
    return true;
  }

  const cached = peekCachedHasPremiumAccess(token);
  if (cached === true) {
    void refreshPremiumAccess(token, appUserId).catch(() => undefined);
    return true;
  }

  const userId = appUserId?.trim();
  if (userId) {
    const numericUserId = Number.parseInt(userId, 10);
    if (Number.isFinite(numericUserId)) {
      const persisted = await loadPersistedEntitlement(numericUserId);
      if (hasPremiumAccess(persisted)) {
        seedEntitlementCache(token, persisted!, numericUserId);
        void refreshPremiumAccess(token, appUserId).catch(() => undefined);
        return true;
      }
    }
  }

  return refreshPremiumAccess(token, appUserId);
}

async function refreshPremiumAccess(token: string, appUserId?: string | null): Promise<boolean> {
  if (await isDevBillingBypassActive()) {
    return true;
  }

  const userId = appUserId?.trim();
  const numericUserId = userId ? Number.parseInt(userId, 10) : Number.NaN;

  // 1) Server first — do not wait on StoreKit/RevenueCat when backend already answered.
  const serverEnt = await withTimeout(
    fetchEntitlement(token, {
      userId: Number.isFinite(numericUserId) ? numericUserId : null,
    }),
    SERVER_CHECK_TIMEOUT_MS,
  );
  if (hasPremiumAccess(serverEnt)) {
    return true;
  }

  // 2) Short RC probe only when server is free/unavailable (covers recent sandbox purchases).
  if (userId) {
    const rcPremium = await withTimeout(
      (async () => {
        await configureRevenueCat(userId);
        const info = await getRevenueCatCustomerInfo(userId);
        if (!isPremiumActive(info)) return false;
        await syncEntitlement(token, {
          app_user_id: userId,
          entitlement: "premium",
          trial_active: false,
          expires_at: activeEntitlementExpiration(info),
        }).catch(() => undefined);
        return true;
      })(),
      REVENUECAT_PROBE_TIMEOUT_MS,
    );
    if (rcPremium) return true;
  }

  if (Number.isFinite(numericUserId)) {
    const persisted = await loadPersistedEntitlement(numericUserId);
    if (hasPremiumAccess(persisted)) {
      seedEntitlementCache(token, persisted!, numericUserId);
      return true;
    }
  }

  return cachedFallback(token);
}

function cachedFallback(token: string): boolean {
  const cached = peekCachedHasPremiumAccess(token);
  return cached === true;
}

export type PremiumGrant =
  | { source: "revenuecat"; customerInfo: Awaited<ReturnType<typeof getRevenueCatCustomerInfo>> }
  | { source: "entitlement"; entitlement: EntitlementDto };

/** Fast multi-source premium check used by paywall bootstrap. */
export async function resolvePremiumGrant(
  token: string | null,
  appUserId?: string | null,
  userIsPremium?: boolean,
  options: { includeRevenueCat?: boolean } = {},
): Promise<PremiumGrant | null> {
  if (isE2eModeEnabled() || (await isDevBillingBypassActive())) {
    return {
      source: "entitlement",
      entitlement: {
        provider: "dev",
        entitlement: "premium",
        trial_active: false,
        expires_at: null,
      },
    };
  }

  if (userIsPremium && token) {
    return {
      source: "entitlement",
      entitlement: {
        provider: "server",
        entitlement: "premium",
        trial_active: false,
        expires_at: null,
      },
    };
  }

  const userId = appUserId?.trim();
  const numericUserId = userId ? Number.parseInt(userId, 10) : Number.NaN;

  if (token && Number.isFinite(numericUserId)) {
    const persisted = await loadPersistedEntitlement(numericUserId);
    if (hasPremiumAccess(persisted)) {
      seedEntitlementCache(token, persisted!, numericUserId);
      return { source: "entitlement", entitlement: persisted! };
    }
  }

  if (token) {
    const cached = peekCachedHasPremiumAccess(token);
    if (cached === true) {
      return {
        source: "entitlement",
        entitlement: {
          provider: "cache",
          entitlement: "premium",
          trial_active: false,
          expires_at: null,
        },
      };
    }
  }

  if (token) {
    const serverEnt = await withTimeout(
      fetchEntitlement(token, {
        userId: Number.isFinite(numericUserId) ? numericUserId : null,
      }),
      SERVER_CHECK_TIMEOUT_MS,
    );
    if (hasPremiumAccess(serverEnt)) {
      return { source: "entitlement", entitlement: serverEnt! };
    }
  }

  if (userId && options.includeRevenueCat !== false) {
    const info = await withTimeout(
      (async () => {
        await configureRevenueCat(userId);
        return getRevenueCatCustomerInfo(userId);
      })(),
      REVENUECAT_PROBE_TIMEOUT_MS,
    );
    if (info && isPremiumActive(info)) {
      return { source: "revenuecat", customerInfo: info };
    }
  }

  return null;
}
