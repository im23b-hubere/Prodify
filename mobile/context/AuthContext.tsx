import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  apiJson,
  setApiUnauthorizedHandler,
  setAuthRefreshBridge,
  warmApi,
} from "../lib/client";
import i18n from "../lib/i18n";
import {
  clearTokenPair,
  readAccessToken,
  readRefreshToken,
  writeTokenPair,
} from "../lib/authTokenStorage";
import { isE2eModeEnabled } from "../lib/e2eMode";
import { setNotificationUserContext } from "../lib/notificationInbox";
import { cancelWeeklyRecapScheduled } from "../lib/weeklyRecapNotifications";
import { syncPendingWeeklyGoal } from "../lib/onboardingGoalSync";
import { configureRevenueCat } from "../lib/revenuecat";
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
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const persistTokenPair = useCallback(async (pair: TokenPair) => {
    await writeTokenPair(pair.access_token, pair.refresh_token);
    setToken(pair.access_token);
  }, []);

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
    setApiUnauthorizedHandler(async () => {
      await clearTokenPair();
      await cancelWeeklyRecapScheduled().catch(() => undefined);
      await setNotificationUserContext(null).catch(() => undefined);
      setToken(null);
      setUser(null);
    });
    return () => setApiUnauthorizedHandler(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await apiJson<AuthenticatedUser>("/auth/me", { token });
      setUser(me);
      await setNotificationUserContext(me.id, me.created_at ?? null).catch(() => undefined);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        await clearTokenPair();
        await setNotificationUserContext(null).catch(() => undefined);
        setToken(null);
      }
      /* Transient errors: keep existing user snapshot to avoid blanking the profile UI. */
    }
  }, [token]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setUser(null);
      return;
    }
    refreshUser().catch(() => setUser(null));
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
      setUser(authenticatedUser);
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
    const previousUserId = user?.id;
    const t = (token?.trim() || (await readAccessToken())) ?? "";
    if (t) {
      await apiJson("/auth/logout", { method: "POST", token: t }).catch(() => undefined);
    }
    await clearLocalAuthSession(previousUserId, false);
    setToken(null);
    setUser(null);
  }, [token, user?.id]);

  const deleteAccount = useCallback(async () => {
    const previousUserId = user?.id;
    const trimmed = (token?.trim() || (await readAccessToken()) || "").trim();
    if (!trimmed) {
      throw new Error(i18n.t("errors.unexpectedResponse"));
    }
    await apiJson("/users/me", { method: "DELETE", token: trimmed });
    await clearLocalAuthSession(previousUserId, true);
    setToken(null);
    setUser(null);
  }, [token, user?.id]);

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
    }),
    [token, user, hydrated, signIn, signUp, signOut, deleteAccount, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
