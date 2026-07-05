import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { memo } from "react";
import { type DimensionValue, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  t: TFunction;
  buddyName: string;
  yourSessions: number;
  buddySessions: number;
  onCatchUp: () => void;
};

export const FriendsBuddyDuelCard = memo(function FriendsBuddyDuelCard({
  t,
  buddyName,
  yourSessions,
  buddySessions,
  onCatchUp,
}: Props) {
  const buddyAhead = buddySessions > yourSessions;
  const youAhead = yourSessions > buddySessions;
  const tied = yourSessions === buddySessions;
  const scale = Math.max(yourSessions, buddySessions, 1);
  const barWidth = (sessions: number): DimensionValue => {
    if (sessions <= 0) return "0%";
    return `${Math.max(8, (sessions / scale) * 100)}%`;
  };
  const yourWidth = barWidth(yourSessions);
  const buddyWidth = barWidth(buddySessions);

  const statusLine = buddyAhead
    ? t("friendsScreen.togetherBuddyBehind")
    : youAhead
      ? t("friendsScreen.togetherBuddyAhead", { buddy: buddyName })
      : tied && yourSessions > 0
        ? t("friendsScreen.togetherBuddyTied")
        : t("friendsScreen.buddyDuelQuietWeek");

  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0f0f0f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shell}
      testID="friends-buddy-duel"
    >
      <Text style={styles.kicker}>{t("friendsScreen.buddyDuelKicker")}</Text>

      <View style={styles.scoreRow}>
        <View style={styles.side}>
          <Text style={styles.sideLabel}>{t("friendsScreen.buddyDuelYouLabel")}</Text>
          <Text style={[styles.score, youAhead && styles.scoreAhead]}>{yourSessions}</Text>
        </View>
        <Text style={styles.vs}>{t("friendsScreen.buddyDuelVs")}</Text>
        <View style={styles.side}>
          <Text style={[styles.sideLabel, styles.sideLabelRight]} numberOfLines={1}>
            {buddyName}
          </Text>
          <Text style={[styles.score, styles.scoreRight, buddyAhead && styles.scoreAhead]}>
            {buddySessions}
          </Text>
        </View>
      </View>

      <View style={styles.bars}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>{t("friendsScreen.buddyDuelYouLabel")}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFillYou, { width: yourWidth }]} />
          </View>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {buddyName}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFillBuddy, { width: buddyWidth }]} />
          </View>
        </View>
      </View>

      <Text style={styles.status}>{statusLine}</Text>

      {buddyAhead ? (
        <PrimaryButton label={t("friendsScreen.heroCtaCatchUp")} onPress={onCatchUp} />
      ) : null}
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    gap: spacing.md,
  },
  kicker: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  side: {
    flex: 1,
    gap: 2,
  },
  sideLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  sideLabelRight: {
    textAlign: "right",
  },
  score: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  scoreRight: {
    textAlign: "right",
  },
  scoreAhead: {
    color: colors.success,
  },
  vs: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingBottom: 6,
  },
  bars: {
    gap: spacing.sm,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  barLabel: {
    width: 52,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFillYou: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  progressFillBuddy: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.secondary,
  },
  status: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    textAlign: "center",
    lineHeight: 18,
  },
});
