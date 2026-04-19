import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ONBOARDING_COMPLETE_KEY, REFRESH_TOKEN_KEY } from "../constants/storageKeys";
import { ApiError, apiJson, setApiUnauthorizedHandler, setAuthRefreshBridge } from "../lib/client";
import i18n from "../lib/i18n";

const TOKEN_KEY = "prodify_token";

type UserMe = {
  id: number;
  email: string;
  username: string;
  profile_picture_url?: string | null;
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
    } catch (e) {
      setUser(null);
      if (e instanceof ApiError && e.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
        setToken(null);
      }
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
      const data = await apiJson<Partial<TokenPair>>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      await persistTokenPair({ access_token: access, refresh_token: refresh });
    },
    [persistTokenPair],
  );

  const signUp = useCallback(
    async (email: string, username: string, password: string) => {
      const data = await apiJson<Partial<TokenPair>>("/auth/register", {
        method: "POST",
        body: { email, username, password },
      });
      const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
      if (!access || !refresh) {
        throw new Error(i18n.t("errors.unexpectedResponse"));
      }
      await persistTokenPair({ access_token: access, refresh_token: refresh });
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
    setToken(null);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const t = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    const trimmed = t?.trim();
    if (!trimmed) {
      throw new Error(i18n.t("errors.unexpectedResponse"));
    }
    await apiJson("/users/me", { method: "DELETE", token: trimmed });
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY).catch(() => undefined);
    setToken(null);
    setUser(null);
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
