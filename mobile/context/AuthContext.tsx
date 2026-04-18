import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, apiJson, setApiUnauthorizedHandler } from "../lib/client";

const TOKEN_KEY = "beattrack_token";

type UserMe = {
  id: number;
  email: string;
  username: string;
};

type AuthContextValue = {
  token: string | null;
  user: UserMe | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
    setApiUnauthorizedHandler(async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
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

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiJson<{ access_token?: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
    if (!access) {
      throw new Error("Unexpected server response. Please try again.");
    }
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    setToken(access);
  }, []);

  const signUp = useCallback(async (email: string, username: string, password: string) => {
    const data = await apiJson<{ access_token?: string }>("/auth/register", {
      method: "POST",
      body: { email, username, password },
    });
    const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
    if (!access) {
      throw new Error("Unexpected server response. Please try again.");
    }
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    setToken(access);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
      refreshUser,
    }),
    [token, user, hydrated, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
