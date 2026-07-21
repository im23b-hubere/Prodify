import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";
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
import {
  clearEntitlementCache,
  clearEntitlementCacheForUser,
  seedEntitlementCache,
  syncEntitlement,
} from "../lib/billing";
import { clearLevelCatalogCache } from "../lib/progressionLevelCatalog";
import { clearProgressionSyncCache } from "../lib/progressionSync";
import { clearDevBillingBypass } from "../lib/devBillingBypass";
import { isE2eModeEnabled } from "../lib/e2eMode";
import { clearNotificationInbox, setNotificationUserContext } from "../lib/notificationInbox";
import { cancelWeeklyRecapScheduled } from "../lib/weeklyRecapNotifications";
import { clearPendingDeepLinkPath } from "../lib/pendingDeepLink";
import { syncPendingWeeklyGoal } from "../lib/onboardingGoalSync";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isPremiumActive,
} from "../lib/revenuecat";

type UserMe = {
  id: number;
  email: string;
  username: string;
  profile_picture_url?: string | null;
  is_premium?: boolean;
  created_at?: string;
};

type AuthContextValue = {
  token: string | null;
  user: UserMe | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account on the server and clears local session data. */
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type TokenPair = { access_token: string; refresh_token: string };

// Render can need close to a minute to wake after an idle period. Auth is the one flow where
// aborting early turns a healthy cold start into a misleading "network error" for the user.
const AUTH_COLD_START_TIMEOUT_MS = 90_000;
const AUTH_IDENTITY_TIMEOUT_MS = 30_000;

/**
 * Billing must never block login/register UX.
 * Configure RevenueCat + sync entitlement in the background after auth succeeds.
 */
function syncBillingInBackground(access: string, me: UserMe): void {
  if (isE2eModeEnabled()) return;

  if (me.is_premium) {
    seedEntitlementCache(
      access,
      {
        provider: "server",
        entitlement: "premium",
        trial_active: false,
        expires_at: null,
      },
      me.id,
    );
  }

  void (async () => {
    try {
      await configureRevenueCat(String(me.id));
      const info = await getRevenueCatCustomerInfo(String(me.id));
      const premium = isPremiumActive(info);
      const synced = await syncEntitlement(access, {
        app_user_id: String(me.id),
        entitlement: premium ? "premium" : "free",
        trial_active: false,
        expires_at: activeEntitlementExpiration(info),
      }).catch(() => null);
      if (premium && synced) {
        seedEntitlementCache(access, synced, me.id);
      }
    } catch {
      /* best effort — tabs/paywall resolve access independently */
    }
  })();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
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
      await clearNotificationInbox().catch(() => undefined);
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
      const me = await apiJson<UserMe>("/auth/me", { token });
      setUser(me);
      await setNotificationUserContext(me.created_at ?? null).catch(() => undefined);
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await apiJson<Partial<TokenPair>>("/auth/login", {
        method: "POST",
        body: { email, password },
        timeoutMs: AUTH_COLD_START_TIMEOUT_MS,
        retries: isE2eModeEnabled() ? 1 : 0,
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      // Verify the authenticated identity before committing tokens locally. Otherwise a transient
      // /auth/me failure leaves the UI reporting a failed login while the next launch is signed in.
      const me = await apiJson<UserMe>("/auth/me", {
        token: access,
        timeoutMs: AUTH_IDENTITY_TIMEOUT_MS,
      });
      await persistTokenPair({ access_token: access, refresh_token: refresh });
      setUser(me);

      void clearNotificationInbox().catch(() => undefined);
      void setNotificationUserContext(me.created_at ?? null).catch(() => undefined);
      void syncPendingWeeklyGoal(access).catch(() => undefined);
      syncBillingInBackground(access, me);
    },
    [persistTokenPair],
  );

  const signUp = useCallback(
    async (email: string, username: string, password: string) => {
      const data = await apiJson<Partial<TokenPair>>("/auth/register", {
        method: "POST",
        body: { email, username, password },
        timeoutMs: AUTH_COLD_START_TIMEOUT_MS,
        retries: 0,
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      const me = await apiJson<UserMe>("/auth/me", {
        token: access,
        timeoutMs: AUTH_IDENTITY_TIMEOUT_MS,
      });
      await persistTokenPair({ access_token: access, refresh_token: refresh });
      setUser(me);

      void clearNotificationInbox().catch(() => undefined);
      void setNotificationUserContext(me.created_at ?? null).catch(() => undefined);
      void syncPendingWeeklyGoal(access).catch(() => undefined);
      syncBillingInBackground(access, me);
    },
    [persistTokenPair],
  );

  const signOut = useCallback(async () => {
    const previousUserId = user?.id;
    const t = (token?.trim() || (await readAccessToken())) ?? "";
    if (t) {
      await apiJson("/auth/logout", { method: "POST", token: t }).catch(() => undefined);
    }
    await clearTokenPair();
    await clearNotificationInbox().catch(() => undefined);
    await cancelWeeklyRecapScheduled().catch(() => undefined);
    await setNotificationUserContext(null).catch(() => undefined);
    await clearPendingDeepLinkPath();
    await clearDevBillingBypass();
    await configureRevenueCat(undefined).catch(() => undefined);
    clearEntitlementCache();
    if (previousUserId != null) {
      await clearEntitlementCacheForUser(previousUserId).catch(() => undefined);
    }
    clearProgressionSyncCache();
    clearLevelCatalogCache();
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
    await clearTokenPair();
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY).catch(() => undefined);
    await clearNotificationInbox().catch(() => undefined);
    await cancelWeeklyRecapScheduled().catch(() => undefined);
    await setNotificationUserContext(null).catch(() => undefined);
    await clearPendingDeepLinkPath();
    await clearDevBillingBypass();
    await configureRevenueCat(undefined).catch(() => undefined);
    clearEntitlementCache();
    if (previousUserId != null) {
      await clearEntitlementCacheForUser(previousUserId).catch(() => undefined);
    }
    clearProgressionSyncCache();
    clearLevelCatalogCache();
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
