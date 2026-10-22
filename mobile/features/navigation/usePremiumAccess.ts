import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getEntitlementCacheRevision,
  peekCachedHasPremiumAccess,
  peekStoredHasPremiumAccess,
  subscribeEntitlementCache,
} from "../../lib/billing";
import { isDevBillingBypassActive, isExpoGoDevRuntime } from "../../lib/devBillingBypass";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import { resolvePremiumAccess } from "../../lib/premiumAccess";

export const ENTITLEMENT_BOOT_TIMEOUT_MS = 10_000;

type PremiumAccessOptions = {
  token?: string | null;
  userId?: number | null;
  userIsPremium: boolean;
};

async function loadFastAccess(
  token: string,
  userId: number | null | undefined,
  userIsPremium: boolean,
): Promise<boolean | null> {
  const cachedAccess = userIsPremium ? true : peekCachedHasPremiumAccess(token);
  if (cachedAccess != null || userId == null) return cachedAccess;
  return (await peekStoredHasPremiumAccess(userId).catch(() => false)) ? true : null;
}

export function usePremiumAccess({ token, userId, userIsPremium }: PremiumAccessOptions) {
  const cacheRevision = useSyncExternalStore(
    subscribeEntitlementCache,
    getEntitlementCacheRevision,
    getEntitlementCacheRevision,
  );
  const [loading, setLoading] = useState(false);
  const [resolvedAccess, setResolvedAccess] = useState<boolean | null>(null);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function resolveAccess() {
      if (!token) {
        setResolvedAccess(null);
        setLoading(false);
        setBootTimedOut(false);
        return;
      }
      if (
        isE2eModeEnabled() ||
        isExpoGoDevRuntime() ||
        (await isDevBillingBypassActive().catch(() => false))
      ) {
        if (!cancelled) {
          setResolvedAccess(true);
          setLoading(false);
          setBootTimedOut(false);
        }
        return;
      }

      const fastAccess = await loadFastAccess(token, userId, userIsPremium);
      if (cancelled) return;
      setResolvedAccess(fastAccess === true ? true : null);
      setLoading(fastAccess !== true);
      setBootTimedOut(false);

      if (fastAccess !== true) {
        timer = setTimeout(() => {
          if (cancelled || settled) return;
          setLoading(false);
          setBootTimedOut(true);
        }, ENTITLEMENT_BOOT_TIMEOUT_MS);
      }

      try {
        const authoritativeAccess = await resolvePremiumAccess(
          token,
          userId != null ? String(userId) : null,
        );
        settled = true;
        if (!cancelled) {
          setResolvedAccess(authoritativeAccess);
          setLoading(false);
          setBootTimedOut(false);
        }
      } catch {
        settled = true;
        if (!cancelled) {
          setResolvedAccess(false);
          setLoading(false);
          setBootTimedOut(false);
        }
      }
    }

    void resolveAccess();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cacheRevision, token, userId, userIsPremium]);

  const cachedAccess = token ? peekCachedHasPremiumAccess(token) : null;
  const hasAccess = userIsPremium || cachedAccess === true || resolvedAccess === true;
  return {
    hasAccess,
    waitingForAccess:
      Boolean(token) && !hasAccess && !bootTimedOut && (loading || resolvedAccess == null),
  };
}
