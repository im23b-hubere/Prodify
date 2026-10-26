import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { passwordResetErrorMessage } from "../authErrorMessage";
import { markOnboardingComplete, navigateAfterSignIn } from "../navigateAfterSignIn";
import { requestPasswordResetCode } from "../passwordResetApi";
import { resolveResetEmail, resolveResetSubmission } from "../passwordResetCredentials";

export type PasswordResetStep = "email" | "code";

export function usePasswordResetForm(t: TFunction) {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<PasswordResetStep>("email");
  const [email, setEmail] = useState(() => params.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = useCallback(async () => {
    if (loading) return;
    const resolved = resolveResetEmail(email);
    if (!resolved.ok) {
      setError(t(`errors.validation.${resolved.error}`));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordResetCode(resolved.email);
      setEmail(resolved.email);
      setStep("code");
    } catch (caught) {
      setError(passwordResetErrorMessage(caught, t));
    } finally {
      setLoading(false);
    }
  }, [email, loading, t]);

  const submit = useCallback(async () => {
    if (loading) return;
    const resolved = resolveResetSubmission(code, newPassword);
    if (!resolved.ok) {
      setError(t(`errors.validation.${resolved.error}`));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email, resolved.code, resolved.newPassword);
      await markOnboardingComplete();
      await navigateAfterSignIn(router);
    } catch (caught) {
      setError(passwordResetErrorMessage(caught, t));
    } finally {
      setLoading(false);
    }
  }, [code, email, loading, newPassword, resetPassword, router, t]);

  const changeEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setNewPassword("");
    setError(null);
  }, []);

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    newPassword,
    setNewPassword,
    error,
    loading,
    sendCode,
    submit,
    changeEmail,
    backToLogin: router.back,
  };
}
