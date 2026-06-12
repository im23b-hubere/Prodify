import {
  fetchEntitlement,
  hasPremiumAccess,
  peekCachedHasPremiumAccess,
  syncEntitlement,
} from "./billing";
import { isDevBillingBypassActive } from "./devBillingBypass";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  isTrialActive,
} from "./revenuecat";

/** Resolve whether the user may access premium-gated tabs (RevenueCat + server). */
export async function resolvePremiumAccess(
  token: string,
  appUserId?: string | null,
): Promise<boolean> {
  if (await isDevBillingBypassActive()) {
    return true;
  }

  const cached = peekCachedHasPremiumAccess(token);
  if (cached === true) {
    void refreshPremiumAccess(token, appUserId).catch(() => undefined);
    return true;
  }

  return refreshPremiumAccess(token, appUserId);
}

async function refreshPremiumAccess(token: string, appUserId?: string | null): Promise<boolean> {
  const userId = appUserId?.trim();
  if (userId) {
    try {
      await configureRevenueCat(userId);
      const info = await getRevenueCatCustomerInfo();
      const premium = isPremiumActive(info);
      const trial = isTrialActive(info);
      if (premium || trial) {
        await syncEntitlement(token, {
          app_user_id: userId,
          entitlement: premium ? "premium" : "free",
          trial_active: trial,
          expires_at: activeEntitlementExpiration(info),
        }).catch(() => undefined);
        return true;
      }
    } catch {
      /* RevenueCat unavailable — fall back to server entitlement */
    }
  }

  try {
    const ent = await fetchEntitlement(token);
    return hasPremiumAccess(ent);
  } catch {
    return cachedFallback(token);
  }
}

function cachedFallback(token: string): boolean {
  const cached = peekCachedHasPremiumAccess(token);
  return cached === true;
}
