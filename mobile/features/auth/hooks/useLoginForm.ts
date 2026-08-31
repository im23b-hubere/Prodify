import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";

import {
  ONBOARDING_COMPLETE_KEY,
  WEEKLY_GOAL_CONFIGURED_KEY,
} from "../../../constants/storageKeys";
import { useAuth } from "../../../context/AuthContext";
import { ApiError } from "../../../lib/client";
import { getE2eTestCredentials } from "../../../lib/e2eCredentials";
import { isE2eModeEnabled } from "../../../lib/e2eMode";
import { replaceWithPendingDeepLinkOrDashboard } from "../../../lib/pendingDeepLink";
import { resolvePostAuthRouteFromStorage, toHref } from "../../../lib/postAuthNavigation";
import { resolveLoginCredentials } from "../loginCredentials";

const TUTORIAL_SEEN_KEY = "prodify_tutorial_v1";

export function useLoginForm(t: TFunction) {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; variant?: string; source?: string }>();
  const preset = getE2eTestCredentials();
  const [email, setEmail] = useState(() => preset?.email ?? "");
  const [password, setPassword] = useState(() => preset?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConnectionHint, setShowConnectionHint] = useState(false);
  const pendingPaywall = params.next === "paywall";
  const existingAccountLogin = params.source === "existing_account";
  const paywallVariant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";

  useEffect(() => {
    if (!loading) {
      setShowConnectionHint(false);
      return;
    }
    const timer = setTimeout(() => setShowConnectionHint(true), 4_000);
    return () => clearTimeout(timer);
  }, [loading]);

  const submit = useCallback(async () => {
    if (loading) return;
    const credentials = resolveLoginCredentials(email, password, getE2eTestCredentials());
    if (!credentials.ok) {
      setError(
        credentials.missing === "email"
          ? t("errors.validation.emailRequired")
          : t("errors.validation.passwordRequired"),
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(credentials.email, credentials.password);
      await prepareE2eAccount();
      if (existingAccountLogin) {
        await markOnboardingComplete();
      }
      if (pendingPaywall) {
        router.replace({
          pathname: "/paywall",
          params: { source: "post_auth", variant: paywallVariant },
        });
        return;
      }
      const route = await resolvePostAuthRouteFromStorage({ hasToken: true, entryPoint: "login" });
      if (route.pathname === "/(tabs)/dashboard") {
        await replaceWithPendingDeepLinkOrDashboard(router);
      } else {
        router.replace(toHref(route));
      }
    } catch (caught) {
      setError(loginErrorMessage(caught, t));
    } finally {
      setLoading(false);
    }
  }, [
    email,
    existingAccountLogin,
    loading,
    password,
    paywallVariant,
    pendingPaywall,
    router,
    signIn,
    t,
  ]);

  const openRegistration = useCallback(() => {
    router.push({
      pathname: "/(auth)/register",
      params: pendingPaywall
        ? { next: "paywall", source: "onboarding", variant: paywallVariant }
        : undefined,
    });
  }, [paywallVariant, pendingPaywall, router]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    showConnectionHint,
    submit,
    openRegistration,
  };
}

async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1").catch(() => undefined);
}

async function prepareE2eAccount(): Promise<void> {
  if (!isE2eModeEnabled()) return;
  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETE_KEY, "1"],
    [WEEKLY_GOAL_CONFIGURED_KEY, "1"],
    [TUTORIAL_SEEN_KEY, "1"],
  ]).catch(() => undefined);
}

function loginErrorMessage(caught: unknown, t: TFunction): string {
  if (caught instanceof ApiError && caught.status === 429) return t("errors.tooManyRequests");
  return caught instanceof Error ? caught.message : t("auth.login.signInFailed");
}
