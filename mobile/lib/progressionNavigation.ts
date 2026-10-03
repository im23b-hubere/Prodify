import type { Href } from "expo-router";

import { returnTo, type ReturnRouter } from "./stackNavigation";

export type ProgressionOverviewFrom = "dashboard" | "stats" | "friends" | "profile";

const FALLBACK_ROUTES: Record<ProgressionOverviewFrom, Href> = {
  dashboard: "/(tabs)/dashboard",
  stats: "/(tabs)/stats",
  friends: "/(tabs)/friends",
  profile: "/(tabs)/profile",
};

export function parseProgressionOverviewFrom(
  raw: string | string[] | undefined,
): ProgressionOverviewFrom {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "stats" || value === "friends" || value === "profile" || value === "dashboard") {
    return value;
  }
  return "dashboard";
}

export function progressionOverviewHref(from: ProgressionOverviewFrom): Href {
  return { pathname: "/progression-overview", params: { from } };
}

export function leaveProgressionOverview(router: ReturnRouter, from: ProgressionOverviewFrom): void {
  returnTo(router, FALLBACK_ROUTES[from]);
}
