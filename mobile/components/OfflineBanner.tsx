import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily } from "../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../constants/theme";

type BannerMode = "none" | "offline" | "limited";

/**
 * Hard offline: no network interface (matches `apiJson` in `lib/client.ts`).
 * Limited: connected but reachability check failed (e.g. LAN dev, captive portal, flaky DNS).
 */
function classifyNetState(state: NetInfoState): BannerMode {
  if (state.isConnected === false) return "offline";
  if (state.isConnected === true && state.isInternetReachable === false) return "limited";
  return "none";
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<BannerMode>("none");

  useEffect(() => {
    let cancelled = false;
    void NetInfo.fetch().then((state) => {
      if (!cancelled) setMode(classifyNetState(state));
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      setMode(classifyNetState(state));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (mode === "none") return null;

  const isOffline = mode === "offline";

  return (
    <View style={[styles.wrap, { top: insets.top + spacing.sm }]} pointerEvents="none">
      <View
        style={[styles.banner, isOffline ? styles.bannerOffline : styles.bannerLimited]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.title} maxFontSizeMultiplier={1.35}>
          {isOffline ? t("offlineBanner.title") : t("offlineBanner.limitedTitle")}
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.35}>
          {isOffline ? t("offlineBanner.body") : t("offlineBanner.limitedBody")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    /** Above `XpHud` (200) so connectivity stays visible. */
    zIndex: 250,
  },
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  bannerOffline: {
    backgroundColor: "rgba(200, 38, 38, 0.95)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  bannerLimited: {
    backgroundColor: "rgba(168, 110, 20, 0.95)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  body: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: fontFamily.body,
    ...typography.caption,
    marginTop: 2,
  },
});
