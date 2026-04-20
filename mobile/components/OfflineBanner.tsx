import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing, typography } from "../constants/theme";
import { fontFamily } from "../constants/fonts";

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.title}>{t("offlineBanner.title")}</Text>
        <Text style={styles.body}>{t("offlineBanner.body")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
  banner: {
    backgroundColor: "rgba(200, 38, 38, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
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
