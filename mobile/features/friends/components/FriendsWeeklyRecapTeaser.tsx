import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import type { TFunction } from "i18next";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  t: TFunction;
  onPress: () => void;
};

export function isWeeklyRecapTeaserVisible(now: Date = new Date()): boolean {
  const day = now.getDay();
  if (day === 0) return true;
  if (day === 6 && now.getHours() >= 18) return true;
  return false;
}

export const FriendsWeeklyRecapTeaser = memo(function FriendsWeeklyRecapTeaser({
  t,
  onPress,
}: Props) {
  if (!isWeeklyRecapTeaserVisible()) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("friendsScreen.recapTeaserA11y")}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      testID="friends-weekly-recap-teaser"
    >
      <LinearGradient
        colors={["#1a0a2e", "#4a148c", "#141414"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.copy}>
          <Text style={styles.kicker}>{t("friendsScreen.recapTeaserKicker")}</Text>
          <Text style={styles.title}>{t("friendsScreen.recapTeaserTitle")}</Text>
          <Text style={styles.subtitle}>{t("friendsScreen.recapTeaserSubtitle")}</Text>
        </View>
        <ChevronRight color={colors.textPrimary} size={22} />
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
    lineHeight: 22,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
});
