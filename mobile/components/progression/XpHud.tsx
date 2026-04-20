import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { tryParseProgressionDto } from "../../lib/outcomesDto";
import { colors, spacing } from "../../constants/theme";
import { fontFamily } from "../../constants/fonts";

export function XpHud() {
  const { token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [xp, setXp] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [xpToNext, setXpToNext] = useState<number | null>(null);

  const hidden = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith("/(auth)")) return true;
    // Expo Router may expose grouped routes with or without "(tabs)" in pathname.
    const allowed = [
      "/dashboard",
      "/stats",
      "/friends",
      "/(tabs)/dashboard",
      "/(tabs)/stats",
      "/(tabs)/friends",
    ];
    return !allowed.some((p) => pathname.startsWith(p));
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || hidden) return;
      try {
        const raw = await apiJson<unknown>("/progression/sync", {
          token,
          method: "POST",
          body: {},
        });
        const parsed = tryParseProgressionDto(raw);
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
  }, [token, pathname, hidden]);

  if (!token || hidden || xp == null || level == null) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open progression"
        style={styles.badge}
        onPress={() => router.push("/(tabs)/stats")}
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
            {xpToNext != null ? `${xpToNext} XP to next` : `${Math.round(progressPercent)}%`}
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
