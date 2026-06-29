import * as Haptics from "expo-haptics";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  onQuickStart: () => void;
};

/** Large invite to start when no session is running (active UI stays on the dashboard for gestures). */
export const DashboardSessionStarter = memo(function DashboardSessionStarter({
  onQuickStart,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.starterContainer} testID="dashboard-start-session">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("sessionStarter.title")}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onQuickStart();
        }}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.quickStart}>
          <Text style={styles.quickEmoji}>▶</Text>
          <Text style={styles.quickTitle}>{t("sessionStarter.title")}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onQuickStart();
        }}
        style={({ pressed }) => [styles.customBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.customTxt}>{t("sessionStarter.customize")}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  starterContainer: { gap: spacing.sm },
  quickStart: {
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  quickEmoji: { fontSize: 36, color: "#fff" },
  quickTitle: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 24,
    letterSpacing: 1.2,
  },
  customBtn: { alignItems: "center", paddingVertical: spacing.xs },
  customTxt: { color: colors.secondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
});
