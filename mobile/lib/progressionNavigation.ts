import type { Href, Router } from "expo-router";
import type { TFunction } from "i18next";

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

export function progressionBackLabel(t: TFunction, from: ProgressionOverviewFrom): string {
  switch (from) {
    case "stats":
      return t("progression.backToStats");
    case "friends":
      return t("progression.backToFriends");
    case "profile":
      return t("progression.backToProfile");
    default:
      return t("progression.backToDashboard");
  }
}

export function leaveProgressionOverview(router: Router, from: ProgressionOverviewFrom): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(FALLBACK_ROUTES[from]);
}
