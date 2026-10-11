import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  requestAppleCredential,
  requestGoogleIdToken,
  type SocialCredentialResult,
  type SocialProvider,
} from "../../../lib/socialSignIn";
import { socialSignInErrorMessage } from "../authErrorMessage";

type UseSocialSignInOptions = {
  t: TFunction;
  /** Runs after the Prodify session exists; owns the post-auth navigation of the hosting screen. */
  onSignedIn: () => Promise<void> | void;
};

export function useSocialSignIn({ t, onSignedIn }: UseSocialSignInOptions) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isGoogleAvailable] = useState(isGoogleSignInAvailable);
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isAppleSignInAvailable().then((available) => {
      if (!cancelled) setIsAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSignIn = useCallback(
    async <T>(
      provider: SocialProvider,
      requestCredential: () => Promise<SocialCredentialResult<T>>,
      authenticate: (credential: T) => Promise<void>,
    ) => {
      if (pendingProvider) return;
      setError(null);
      setPendingProvider(provider);
      try {
        const result = await requestCredential();
        if (result.status === "cancelled") return;
        await authenticate(result.credential);
        await onSignedIn();
      } catch (caught) {
        setError(socialSignInErrorMessage(caught, t));
      } finally {
        setPendingProvider(null);
      }
    },
    [onSignedIn, pendingProvider, t],
  );

  const continueWithApple = useCallback(
    () => runSignIn("apple", requestAppleCredential, signInWithApple),
    [runSignIn, signInWithApple],
  );

  const continueWithGoogle = useCallback(
    () => runSignIn("google", requestGoogleIdToken, signInWithGoogle),
    [runSignIn, signInWithGoogle],
  );

  return {
    isAppleAvailable,
    isGoogleAvailable,
    hasAnyProvider: isAppleAvailable || isGoogleAvailable,
    pendingProvider,
    error,
    continueWithApple,
    continueWithGoogle,
  };
}

export type SocialSignInController = ReturnType<typeof useSocialSignIn>;
