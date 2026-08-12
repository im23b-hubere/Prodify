import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getEntitlementCacheRevision,
  peekCachedHasPremiumAccess,
  peekStoredHasPremiumAccess,
  subscribeEntitlementCache,
} from "../../lib/billing";
import { isDevBillingBypassActive } from "../../lib/devBillingBypass";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import { resolvePremiumAccess } from "../../lib/premiumAccess";

const ENTITLEMENT_BOOT_TIMEOUT_MS = 10_000;

type PremiumTabAccessOptions = {
  token?: string | null;
  userId?: number | null;
  userIsPremium: boolean;
};

function timeoutAccessFallback(fallback: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(fallback), ENTITLEMENT_BOOT_TIMEOUT_MS);
  });
}

async function loadFastAccess(
  token: string,
  userId: number | null | undefined,
  userIsPremium: boolean,
): Promise<boolean | null> {
  const cachedAccess = userIsPremium ? true : peekCachedHasPremiumAccess(token);
  if (cachedAccess != null || userId == null) return cachedAccess;
  return (await peekStoredHasPremiumAccess(userId).catch(() => false)) ? true : null;
}

export function usePremiumTabAccess({ token, userId, userIsPremium }: PremiumTabAccessOptions) {
  const cacheRevision = useSyncExternalStore(
    subscribeEntitlementCache,
    getEntitlementCacheRevision,
    getEntitlementCacheRevision,
  );
  const [loading, setLoading] = useState(false);
  const [resolvedAccess, setResolvedAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      if (!token) {
        setResolvedAccess(null);
        setLoading(false);
        return;
      }
      if (isE2eModeEnabled() || (await isDevBillingBypassActive().catch(() => false))) {
        if (!cancelled) {
          setResolvedAccess(true);
          setLoading(false);
        }
        return;
      }

      const fastAccess = await loadFastAccess(token, userId, userIsPremium);
      if (cancelled) return;
      setResolvedAccess(fastAccess === true ? true : null);
      setLoading(fastAccess !== true);

      const authoritativeAccess = await Promise.race([
        resolvePremiumAccess(token, userId != null ? String(userId) : null),
        timeoutAccessFallback(fastAccess === true),
      ]);
      if (!cancelled) {
        setResolvedAccess(authoritativeAccess);
        setLoading(false);
      }
    }

    void resolveAccess();
    return () => {
      cancelled = true;
    };
  }, [cacheRevision, token, userId, userIsPremium]);

  const cachedAccess = token ? peekCachedHasPremiumAccess(token) : null;
  const hasAccess = userIsPremium || cachedAccess === true || resolvedAccess === true;
  return {
    hasAccess,
    waitingForAccess: Boolean(token) && !hasAccess && (loading || resolvedAccess == null),
  };
}
