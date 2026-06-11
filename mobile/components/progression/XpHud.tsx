import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import {
  type ProgressionOverviewFrom,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";
import { syncProgression } from "../../lib/progressionSync";
import { colors, spacing } from "../../constants/theme";
import { fontFamily } from "../../constants/fonts";

const HUD_TAB_NAMES = new Set(["dashboard", "stats", "friends", "profile"]);

/** Main tab routes where the HUD is useful; hidden elsewhere (auth, sessions, modals, …). */
const HUD_TAB_PREFIXES = [
  "/dashboard",
  "/stats",
  "/friends",
  "/profile",
  "/(tabs)/dashboard",
  "/(tabs)/stats",
  "/(tabs)/friends",
  "/(tabs)/profile",
] as const;

function isHudTabRoute(pathname: string | null, segments: string[]): boolean {
  if (pathname?.startsWith("/(auth)")) return false;
  if (pathname && HUD_TAB_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  const tab = segments[0] === "(tabs)" ? segments[1] : segments[0];
  return typeof tab === "string" && HUD_TAB_NAMES.has(tab);
}

export function XpHud() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [xp, setXp] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [xpToNext, setXpToNext] = useState<number | null>(null);

  const hidden = useMemo(
    () => !isHudTabRoute(pathname, segments as string[]),
    [pathname, segments],
  );

  useEffect(() => {
    // Prevent showing stale XP while switching accounts/routes.
    if (!token || hidden) {
      setXp(null);
      setLevel(null);
      setProgressPercent(0);
      setXpToNext(null);
    }
  }, [hidden, token, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || hidden) return;
      try {
        const parsed = await syncProgression(token);
        if (!cancelled && parsed) {
          setXp(parsed.xp_total);
          setLevel(parsed.current_level);
          setProgressPercent(Math.max(0, Math.min(100, parsed.progress_percent ?? 0)));
          setXpToNext(Math.max(0, parsed.xp_to_next_level ?? 0));
        }
      } catch {
        if (!cancelled) {
          setXp(null);
          setLevel(null);
          setXpToNext(null);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, pathname, hidden, user?.id]);

  const hudFrom = useMemo((): ProgressionOverviewFrom => {
    const tab = segments[0] === "(tabs)" ? segments[1] : segments[0];
    if (tab === "stats" || tab === "friends" || tab === "profile" || tab === "dashboard") {
      return tab;
    }
    return "dashboard";
  }, [segments]);

  if (!token || hidden || xp == null || level == null) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("progression.xpHudA11y")}
        style={styles.badge}
        onPress={() => router.push(progressionOverviewHref(hudFrom))}
      >
        <View style={styles.row}>
          <Text style={styles.level}>Lv {level}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.xp}>{xp.toLocaleString()} XP</Text>
        </View>
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.nextLevelHint}>
            {xpToNext != null
              ? t("progression.xpHudToNext", { xp: xpToNext })
              : t("progression.xpHudPercent", { percent: Math.round(progressPercent) })}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: spacing.md,
    zIndex: 200,
  },
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,12,12,0.82)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 104,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  level: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    lineHeight: 11,
  },
  dot: { color: colors.textSecondary, fontSize: 9, lineHeight: 11 },
  xp: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 9,
    lineHeight: 11,
  },
  trackWrap: {
    marginTop: 4,
    alignItems: "center",
  },
  track: {
    width: 66,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#d1d5db",
  },
  nextLevelHint: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 8,
    lineHeight: 10,
  },
});
