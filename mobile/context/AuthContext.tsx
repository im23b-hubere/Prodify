import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ApiError,
  apiJson,
  setApiUnauthorizedHandler,
  setAuthRefreshBridge,
  warmApi,
} from "../lib/client";
import i18n from "../lib/i18n";
import { readAccessToken, readRefreshToken, writeTokenPair } from "../lib/authTokenStorage";
import { isE2eModeEnabled } from "../lib/e2eMode";
import { setNotificationUserContext } from "../lib/notificationInbox";
import { syncPendingWeeklyGoal } from "../lib/onboardingGoalSync";
import { configureRevenueCat } from "../lib/revenuecat";
import { useLatestRef } from "../hooks/useLatestRef";
import {
  authenticate,
  clearLocalAuthSession,
  syncBillingInBackground,
  type AuthenticatedUser,
  type TokenPair,
} from "../lib/authSessionService";

type AuthContextValue = {
  token: string | null;
  user: AuthenticatedUser | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account on the server and clears local session data. */
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Replace the in-memory profile snapshot (e.g. after profile picture upload). */
  applyAuthenticatedUser: (user: AuthenticatedUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Render can need close to a minute to wake after an idle period. Auth is the one flow where
// aborting early turns a healthy cold start into a misleading "network error" for the user.
const AUTH_COLD_START_TIMEOUT_MS = 90_000;
const AUTH_IDENTITY_TIMEOUT_MS = 30_000;

/**
 * Billing must never block login/register UX.
 * Configure RevenueCat + sync entitlement in the background after auth succeeds.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthenticatedUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dropLocalSessionRef = useRef<Promise<void> | null>(null);

  // A profile only means anything while a token backs it. Deriving the exposed user keeps that
  // invariant structural instead of relying on every sign-out path to remember to clear it.
  const user = token ? profile : null;
  const sessionUserIdRef = useLatestRef(profile?.id);

  const persistTokenPair = useCallback(async (pair: TokenPair) => {
    await writeTokenPair(pair.access_token, pair.refresh_token);
    setToken(pair.access_token);
  }, []);

  const dropLocalSession = useCallback(async () => {
    if (dropLocalSessionRef.current) return dropLocalSessionRef.current;
    const previousUserId = sessionUserIdRef.current;
    const run = (async () => {
      await clearLocalAuthSession(previousUserId, false);
      setToken(null);
      setProfile(null);
    })();
    dropLocalSessionRef.current = run.finally(() => {
      dropLocalSessionRef.current = null;
    });
    return dropLocalSessionRef.current;
  }, [sessionUserIdRef]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readAccessToken();
        if (!cancelled) setToken(stored);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated && !token) void warmApi();
  }, [hydrated, token]);

  useEffect(() => {
    setAuthRefreshBridge(() => readRefreshToken(), persistTokenPair);
    return () => setAuthRefreshBridge(null, null);
  }, [persistTokenPair]);

  useEffect(() => {
    setApiUnauthorizedHandler(() => dropLocalSession());
    return () => setApiUnauthorizedHandler(null);
  }, [dropLocalSession]);

  const refreshUser = useCallback(async () => {
    // No token means the derived user is already null, so there is nothing to fetch or clear.
    if (!token) return;
    try {
      const me = await apiJson<AuthenticatedUser>("/auth/me", { token });
      setProfile(me);
      await setNotificationUserContext(me.id, me.created_at ?? null).catch(() => undefined);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await dropLocalSession();
      }
      /* Transient errors: keep existing user snapshot to avoid blanking the profile UI. */
    }
  }, [dropLocalSession, token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    void (async () => {
      try {
        await refreshUser();
      } catch {
        setProfile(null);
      }
    })();
  }, [hydrated, token, refreshUser]);

  useEffect(() => {
    if (!token || user?.id == null || isE2eModeEnabled()) return;
    void configureRevenueCat(String(user.id)).catch(() => undefined);
  }, [token, user?.id]);

  const completeAuthentication = useCallback(
    async (
      path: "/auth/login" | "/auth/register",
      body: Record<string, string>,
      retries: number,
    ) => {
      const { pair, user: authenticatedUser } = await authenticate({
        path,
        body,
        retries,
        timeoutMs: AUTH_COLD_START_TIMEOUT_MS,
        identityTimeoutMs: AUTH_IDENTITY_TIMEOUT_MS,
        unexpectedResponseMessage: i18n.t("errors.unexpectedResponse"),
      });
      await persistTokenPair(pair);
      setProfile(authenticatedUser);
      void setNotificationUserContext(authenticatedUser.id, authenticatedUser.created_at ?? null).catch(
        () => undefined,
      );
      void syncPendingWeeklyGoal(pair.access_token).catch(() => undefined);
      if (!isE2eModeEnabled()) syncBillingInBackground(pair.access_token, authenticatedUser);
    },
    [persistTokenPair],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      completeAuthentication("/auth/login", { email, password }, isE2eModeEnabled() ? 1 : 0),
    [completeAuthentication],
  );

  const signUp = useCallback(
    (email: string, username: string, password: string) =>
      completeAuthentication("/auth/register", { email, username, password }, 0),
    [completeAuthentication],
  );

  const signOut = useCallback(async () => {
    const t = (token?.trim() || (await readAccessToken())) ?? "";
    if (t) {
      await apiJson("/auth/logout", { method: "POST", token: t }).catch(() => undefined);
    }
    await dropLocalSession();
  }, [dropLocalSession, token]);

  const deleteAccount = useCallback(async () => {
    const previousUserId = user?.id;
    const trimmed = (token?.trim() || (await readAccessToken()) || "").trim();
    if (!trimmed) {
      throw new Error(i18n.t("errors.unexpectedResponse"));
    }
    await apiJson("/users/me", { method: "DELETE", token: trimmed });
    await clearLocalAuthSession(previousUserId, true);
    setToken(null);
    setProfile(null);
  }, [token, user?.id]);

  const applyAuthenticatedUser = useCallback((next: AuthenticatedUser) => {
    setProfile(next);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      hydrated,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      refreshUser,
      applyAuthenticatedUser,
    }),
    [
      token,
      user,
      hydrated,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      refreshUser,
      applyAuthenticatedUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
