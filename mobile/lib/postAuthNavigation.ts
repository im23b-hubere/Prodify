import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";

export type PostAuthEntryPoint = "login" | "register" | "app_launch";
export type PaywallSource = "onboarding" | "post_auth" | "in_app";

type HrefPath =
  | "/(auth)/login"
  | "/(auth)/register"
  | "/onboarding"
  | "/paywall"
  | "/(tabs)/dashboard";

export type ResolvedRoute = {
  pathname: HrefPath;
  params?: Record<string, string>;
};

export type ResolvePostAuthRouteInput = {
  hasToken: boolean;
  onboardingComplete: boolean;
  entryPoint: PostAuthEntryPoint;
  allowPaywallPrompt?: boolean;
};

export const DASHBOARD_TAB_HREF: HrefPath = "/(tabs)/dashboard";

// Backward-compatible route constants consumed by existing tests/callers.
export const POST_REGISTER_HREF: HrefPath = "/onboarding";

export async function readOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

/** Where unauthenticated users land when auth is required (deep links, cold start). */
export function resolveUnauthenticatedAuthHref(onboardingComplete: boolean): HrefPath {
  return onboardingComplete ? "/(auth)/login" : "/onboarding";
}

/** Fallback when a deep link path is invalid or blocked. */
export function resolveDeepLinkFallbackHref(
  hasToken: boolean,
  onboardingComplete: boolean,
): HrefPath {
  if (hasToken) return DASHBOARD_TAB_HREF;
  return resolveUnauthenticatedAuthHref(onboardingComplete);
}

export function resolvePostAuthRoute({
  hasToken,
  onboardingComplete,
  entryPoint,
  allowPaywallPrompt = true,
}: ResolvePostAuthRouteInput): ResolvedRoute {
  if (!hasToken) {
    return { pathname: resolveUnauthenticatedAuthHref(onboardingComplete) };
  }

  if (!onboardingComplete) {
    return { pathname: "/onboarding" };
  }

  if (allowPaywallPrompt && entryPoint === "register") {
    return { pathname: "/paywall", params: { source: "post_auth" } };
  }

  return { pathname: "/(tabs)/dashboard" };
}

export async function resolvePostAuthRouteFromStorage(
  input: Omit<ResolvePostAuthRouteInput, "onboardingComplete">,
): Promise<ResolvedRoute> {
  const onboardingComplete = await readOnboardingComplete();
  return resolvePostAuthRoute({ ...input, onboardingComplete });
}

export function resolvePaywallExitRoute(source: PaywallSource, hasToken: boolean): HrefPath | null {
  if (source === "onboarding" && hasToken) return "/(tabs)/dashboard";
  if (source === "onboarding" && !hasToken) return "/(auth)/register";
  if (source === "post_auth") return "/(tabs)/dashboard";
  return null;
}

export function toHref(route: ResolvedRoute): Href {
  if (route.params) {
    return { pathname: route.pathname, params: route.params } as Href;
  }
  return route.pathname as Href;
}

// Backward-compatible helper used by legacy auth flow tests.
export async function getPostLoginHref(): Promise<HrefPath> {
  const onboardingComplete = await readOnboardingComplete();
  return onboardingComplete ? "/(tabs)/dashboard" : "/onboarding";
}
