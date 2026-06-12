import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ONBOARDING_COMPLETE_KEY, REFRESH_TOKEN_KEY } from "../constants/storageKeys";
import { ApiError, apiJson, setApiUnauthorizedHandler, setAuthRefreshBridge } from "../lib/client";
import i18n from "../lib/i18n";
import {
  clearEntitlementCache,
  fetchEntitlement,
  hasPremiumAccess,
  syncEntitlement,
} from "../lib/billing";
import { clearLevelCatalogCache } from "../lib/progressionLevelCatalog";
import { clearProgressionSyncCache } from "../lib/progressionSync";
import { clearDevBillingBypass } from "../lib/devBillingBypass";
import { clearNotificationInbox, setNotificationUserContext } from "../lib/notificationInbox";
import { clearPendingDeepLinkPath } from "../lib/pendingDeepLink";
import { syncPendingWeeklyGoal } from "../lib/onboardingGoalSync";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  isTrialActive,
} from "../lib/revenuecat";

const TOKEN_KEY = "prodify_token";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const persistTokenPair = useCallback(async (pair: TokenPair) => {
    await SecureStore.setItemAsync(TOKEN_KEY, pair.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, pair.refresh_token);
    setToken(pair.access_token);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!cancelled) setToken(stored?.trim() ?? null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAuthRefreshBridge(() => SecureStore.getItemAsync(REFRESH_TOKEN_KEY), persistTokenPair);
    return () => setAuthRefreshBridge(null, null);
  }, [persistTokenPair]);

  useEffect(() => {
    setApiUnauthorizedHandler(async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
      await clearNotificationInbox().catch(() => undefined);
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
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      await clearNotificationInbox().catch(() => undefined);
      const data = await apiJson<Partial<TokenPair>>("/auth/login", {
        method: "POST",
        body: { email, password },
        timeoutMs: 60_000,
        retries: 2,
        retryUnsafeMethods: ["POST"],
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      await persistTokenPair({ access_token: access, refresh_token: refresh });
      await syncPendingWeeklyGoal(access).catch(() => undefined);
      try {
        const me = await apiJson<UserMe>("/auth/me", { token: access });
        setUser(me);
        await setNotificationUserContext(me.created_at ?? null).catch(() => undefined);
        if (__DEV__) {
          const ent = await fetchEntitlement(access);
          if (!hasPremiumAccess(ent)) {
            await configureRevenueCat(String(me.id));
            const info = await getRevenueCatCustomerInfo();
            await syncEntitlement(access, {
              app_user_id: String(me.id),
              entitlement: isPremiumActive(info) ? "premium" : "free",
              trial_active: isTrialActive(info),
              expires_at: activeEntitlementExpiration(info),
            });
          }
        } else {
          await configureRevenueCat(String(me.id));
          const info = await getRevenueCatCustomerInfo();
          await syncEntitlement(access, {
            app_user_id: String(me.id),
            entitlement: isPremiumActive(info) ? "premium" : "free",
            trial_active: isTrialActive(info),
            expires_at: activeEntitlementExpiration(info),
          });
        }
      } catch {
        /* best effort: auth succeeds even if billing sync fails */
      }
    },
    [persistTokenPair],
  );

  const signUp = useCallback(
    async (email: string, username: string, password: string) => {
      await clearNotificationInbox().catch(() => undefined);
      const data = await apiJson<Partial<TokenPair>>("/auth/register", {
        method: "POST",
        body: { email, username, password },
        timeoutMs: 60_000,
        retries: 2,
        retryUnsafeMethods: ["POST"],
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      await persistTokenPair({ access_token: access, refresh_token: refresh });
      await syncPendingWeeklyGoal(access).catch(() => undefined);
      try {
        const me = await apiJson<UserMe>("/auth/me", { token: access });
        await setNotificationUserContext(me.created_at ?? null).catch(() => undefined);
        await configureRevenueCat(String(me.id));
        const info = await getRevenueCatCustomerInfo();
        await syncEntitlement(access, {
          app_user_id: String(me.id),
          entitlement: isPremiumActive(info) ? "premium" : "free",
          trial_active: isTrialActive(info),
          expires_at: activeEntitlementExpiration(info),
        });
      } catch {
        /* best effort: auth succeeds even if billing sync fails */
      }
    },
    [persistTokenPair],
  );

  const signOut = useCallback(async () => {
    const t = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    if (t?.trim()) {
      await apiJson("/auth/logout", { method: "POST", token: t.trim() }).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    await clearNotificationInbox().catch(() => undefined);
    await setNotificationUserContext(null).catch(() => undefined);
    await clearPendingDeepLinkPath();
    await clearDevBillingBypass();
    await configureRevenueCat(undefined).catch(() => undefined);
    clearEntitlementCache();
    clearProgressionSyncCache();
    clearLevelCatalogCache();
    setToken(null);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const fromStore = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    const trimmed = (token?.trim() || fromStore?.trim() || "").trim();
    if (!trimmed) {
      throw new Error(i18n.t("errors.unexpectedResponse"));
    }
    await apiJson("/users/me", { method: "DELETE", token: trimmed });
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY).catch(() => undefined);
    await clearNotificationInbox().catch(() => undefined);
    await setNotificationUserContext(null).catch(() => undefined);
    await clearPendingDeepLinkPath();
    await clearDevBillingBypass();
    await configureRevenueCat(undefined).catch(() => undefined);
    clearEntitlementCache();
    clearProgressionSyncCache();
    clearLevelCatalogCache();
    setToken(null);
    setUser(null);
  }, [token]);

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
