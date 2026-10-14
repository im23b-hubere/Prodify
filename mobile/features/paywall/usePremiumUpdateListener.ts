import { useEffect, useRef } from "react";
import type { CustomerInfo } from "react-native-purchases";

import { isPremiumActive, subscribeToCustomerInfoUpdates } from "../../lib/revenuecat";

type Options = {
  /** Off while a purchase or restore runs: that flow owns the unlock and its confirmation. */
  enabled: boolean;
  onPremium: (info: CustomerInfo) => void;
};

/** Leave the paywall as soon as RevenueCat reports access that arrived after it opened. */
export function usePremiumUpdateListener({ enabled, onPremium }: Options) {
  const onPremiumRef = useRef(onPremium);
  const hasUnlocked = useRef(false);

  useEffect(() => {
    onPremiumRef.current = onPremium;
  }, [onPremium]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToCustomerInfoUpdates((info) => {
      if (hasUnlocked.current || !isPremiumActive(info)) return;
      hasUnlocked.current = true;
      onPremiumRef.current(info);
    });
  }, [enabled]);
}
