import { usePreventRemove } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler } from "react-native";

import { replaceWithPendingDeepLinkOrDashboard } from "../../lib/pendingDeepLink";
import { resolvePaywallExitRoute, type PaywallSource } from "../../lib/postAuthNavigation";

export type PaywallExit = "dashboard" | "login" | "register" | "back";

function exitAfterUnlock(source: PaywallSource, authenticated: boolean): PaywallExit {
  const route = resolvePaywallExitRoute(source, authenticated);
  if (route === "/(tabs)/dashboard") return "dashboard";
  if (route === "/(auth)/register") return "register";
  if (route === "/(auth)/login") return "login";
  return "back";
}

export function usePaywallExit(source: PaywallSource, authenticated: boolean) {
  const { t } = useTranslation();
  const router = useRouter();
  const blockExit = source === "post_auth" || source === "onboarding";
  const [allowRemove, setAllowRemove] = useState(false);
  const [pendingExit, setPendingExit] = useState<PaywallExit | null>(null);
  const unlockAlertPending = useRef(false);
  const unlockExitRequested = useRef(false);

  usePreventRemove(
    blockExit && !allowRemove,
    useCallback(() => {}, []),
  );

  useEffect(() => {
    if (!allowRemove || pendingExit == null) return;
    const exit = pendingExit;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (exit === "dashboard") await replaceWithPendingDeepLinkOrDashboard(router);
          else if (exit === "login") router.replace("/(auth)/login");
          else if (exit === "register") router.replace("/(auth)/register");
          else router.back();
        } finally {
          setPendingExit(null);
          if (unlockAlertPending.current) {
            unlockAlertPending.current = false;
            Alert.alert(
              t("paywall.alerts.premiumUnlockedTitle"),
              t("paywall.alerts.premiumUnlockedBody"),
            );
          }
        }
      })();
    }, 100);
    return () => clearTimeout(timer);
  }, [allowRemove, pendingExit, router, t]);

  useEffect(() => {
    if (!blockExit) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [blockExit]);

  const requestExit = useCallback((exit: PaywallExit) => {
    setPendingExit(exit);
    setAllowRemove(true);
  }, []);

  const requestExitAfterUnlock = useCallback(
    (showConfirmation = false) => {
      if (unlockExitRequested.current) return;
      unlockExitRequested.current = true;
      unlockAlertPending.current = showConfirmation;
      requestExit(exitAfterUnlock(source, authenticated));
    },
    [authenticated, requestExit, source],
  );

  return {
    requestExit,
    requestExitAfterUnlock,
    resolveExitAfterUnlock: () => exitAfterUnlock(source, authenticated),
  };
}
