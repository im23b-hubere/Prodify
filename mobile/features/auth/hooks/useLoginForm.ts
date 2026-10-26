import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";

import { ONBOARDING_COMPLETE_KEY } from "../../../constants/storageKeys";
import { useAuth } from "../../../context/AuthContext";
import { getE2eTestCredentials } from "../../../lib/e2eCredentials";
import { isE2eModeEnabled } from "../../../lib/e2eMode";
import { useConnectionHint } from "./useConnectionHint";
import { loginErrorMessage } from "../authErrorMessage";
import { resolveLoginCredentials } from "../loginCredentials";
import { markOnboardingComplete, navigateAfterSignIn } from "../navigateAfterSignIn";

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
  const showConnectionHint = useConnectionHint(loading);
  const pendingPaywall = params.next === "paywall";
  const existingAccountLogin = params.source === "existing_account";
  const paywallVariant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";

  /** Post-auth navigation shared by email and Apple / Google sign-in. */
  const finishSignIn = useCallback(async () => {
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
    await navigateAfterSignIn(router);
  }, [existingAccountLogin, paywallVariant, pendingPaywall, router]);

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
      await finishSignIn();
    } catch (caught) {
      setError(loginErrorMessage(caught, t));
    } finally {
      setLoading(false);
    }
  }, [email, finishSignIn, loading, password, signIn, t]);

  const openRegistration = useCallback(() => {
    router.push({
      pathname: "/(auth)/register",
      params: pendingPaywall
        ? { next: "paywall", source: "onboarding", variant: paywallVariant }
        : undefined,
    });
  }, [paywallVariant, pendingPaywall, router]);

  const openPasswordReset = useCallback(() => {
    const typedEmail = email.trim();
    router.push({
      pathname: "/(auth)/forgot-password",
      params: typedEmail ? { email: typedEmail } : undefined,
    });
  }, [email, router]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    showConnectionHint,
    submit,
    finishSignIn,
    openRegistration,
    openPasswordReset,
  };
}

async function prepareE2eAccount(): Promise<void> {
  if (!isE2eModeEnabled()) return;
  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETE_KEY, "1"],
    [TUTORIAL_SEEN_KEY, "1"],
  ]).catch(() => undefined);
}
