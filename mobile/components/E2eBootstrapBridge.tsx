import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import {
  ONBOARDING_COMPLETE_KEY,
  WEEKLY_GOAL_CONFIGURED_KEY,
} from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { extractDeepLinkPath } from "../lib/deepLinkGuard";
import { isE2eModeEnabled } from "../lib/e2eMode";
import { clearPendingDeepLinkPath } from "../lib/pendingDeepLink";
import { DASHBOARD_TAB_HREF } from "../lib/postAuthNavigation";

const BOOTSTRAP_PATH = "e2e/bootstrap";

function readParam(url: string, key: string): string {
  try {
    return new URL(url).searchParams.get(key)?.trim() ?? "";
  } catch {
    const parsed = Linking.parse(url);
    const value = parsed.queryParams?.[key];
    return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
  }
}

function isBootstrapUrl(url: string): boolean {
  return extractDeepLinkPath(url) === BOOTSTRAP_PATH;
}

export function isE2eBootstrapDeepLink(url: string): boolean {
  return isE2eModeEnabled() && isBootstrapUrl(url);
}

export function E2eBootstrapBridge() {
  const router = useRouter();
  const { signIn } = useAuth();
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isE2eModeEnabled()) return undefined;

    const bootstrap = async (url: string) => {
      if (!isBootstrapUrl(url) || handledUrlRef.current === url) return;
      handledUrlRef.current = url;

      const email = readParam(url, "email");
      const password = readParam(url, "password");
      if (!email || !password) {
        console.warn("E2E bootstrap skipped: email/password query params are required.");
        return;
      }

      await AsyncStorage.multiSet([
        [ONBOARDING_COMPLETE_KEY, "1"],
        [WEEKLY_GOAL_CONFIGURED_KEY, "1"],
      ]);
      await clearPendingDeepLinkPath();
      await signIn(email, password);
      router.replace(DASHBOARD_TAB_HREF as Href);
    };

    const sub = Linking.addEventListener("url", ({ url }) => {
      void bootstrap(url).catch((error) => {
        console.warn("E2E bootstrap failed.", error);
      });
    });

    void Linking.getInitialURL()
      .then((url) => {
        if (url) return bootstrap(url);
        return undefined;
      })
      .catch(() => undefined);

    return () => sub.remove();
  }, [router, signIn]);

  return null;
}
