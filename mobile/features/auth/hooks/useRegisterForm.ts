import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { readOnboardingComplete } from "../../../lib/postAuthNavigation";
import { registrationErrorMessage } from "../authErrorMessage";
import { resolveRegistrationCredentials } from "../registerCredentials";

function useConnectionHint(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 4_000);
    return () => clearTimeout(timer);
  }, [loading]);
  return visible;
}

export function useRegisterForm(t: TFunction) {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; variant?: string }>();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingPaywall = params.next === "paywall";
  const paywallVariant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";
  const showConnectionHint = useConnectionHint(loading);

  const submit = useCallback(async () => {
    if (loading) return;
    const result = resolveRegistrationCredentials(email, username, password);
    if (!result.ok) {
      setError(t(`errors.validation.${result.error}`));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { credentials } = result;
      await signUp(credentials.email, credentials.username, credentials.password);
      const onboarded = await readOnboardingComplete();
      if (pendingPaywall || onboarded) {
        router.replace({
          pathname: "/paywall",
          params: { source: "post_auth", variant: paywallVariant },
        });
      } else {
        router.replace("/onboarding");
      }
    } catch (caught) {
      setError(registrationErrorMessage(caught, t));
    } finally {
      setLoading(false);
    }
  }, [email, loading, password, paywallVariant, pendingPaywall, router, signUp, t, username]);

  const openLogin = useCallback(() => {
    const nextParams = pendingPaywall
      ? { next: "paywall", source: "onboarding", variant: paywallVariant }
      : undefined;
    router.push({ pathname: "/(auth)/login", params: nextParams });
  }, [paywallVariant, pendingPaywall, router]);

  return {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    error,
    loading,
    showConnectionHint,
    submit,
    openLogin,
  };
}

export type RegisterFormController = ReturnType<typeof useRegisterForm>;
