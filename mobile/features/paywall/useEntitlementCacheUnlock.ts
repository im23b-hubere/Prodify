import { useEffect, useRef } from "react";

import { peekCachedHasPremiumAccess, subscribeEntitlementCache } from "../../lib/billing";

type Options = {
  token: string | null;
  enabled: boolean;
  onPremium: () => void;
};

/** Leave the paywall when a check that outlived the boot wait writes premium into the cache. */
export function useEntitlementCacheUnlock({ token, enabled, onPremium }: Options) {
  const onPremiumRef = useRef(onPremium);

  useEffect(() => {
    onPremiumRef.current = onPremium;
  }, [onPremium]);

  useEffect(() => {
    if (!enabled || !token) return undefined;
    let unlocked = false;
    const unlockIfPremium = () => {
      if (unlocked || peekCachedHasPremiumAccess(token) !== true) return;
      unlocked = true;
      onPremiumRef.current();
    };
    unlockIfPremium();
    return subscribeEntitlementCache(unlockIfPremium);
  }, [enabled, token]);
}
