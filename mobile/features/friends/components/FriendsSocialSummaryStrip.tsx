import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";

type Props = {
  t: TFunction;
  mode: "week" | "all";
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
};

export const FriendsSocialSummaryStrip = memo(function FriendsSocialSummaryStrip({
  t,
  mode,
  entries,
  currentUserId,
}: Props) {
  const summary = useMemo(() => {
    const friendCount = Math.max(0, entries.length - 1);
    const you = entries.find((entry) => entry.user_id === currentUserId);
    const crewSessions = entries.reduce((sum, entry) => sum + entry.sessions_in_period, 0);
    return {
      friendCount,
      rank: you?.rank ?? null,
      crewSessions,
    };
  }, [currentUserId, entries]);

  if (summary.friendCount <= 0) return null;

  const rankLine =
    summary.rank != null
      ? mode === "week"
        ? t("friendsScreen.summaryRankWeek", { rank: summary.rank })
        : t("friendsScreen.summaryRankAll", { rank: summary.rank })
      : null;

  const sessionsLine =
    mode === "week"
      ? t("friendsScreen.summaryCrewSessionsWeek", { sessions: summary.crewSessions })
      : t("friendsScreen.summaryCrewSessionsAll", { sessions: summary.crewSessions });

  return (
    <LinearGradient
      colors={["#1a1030", "#141414", "#0a0a0a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shell}
      testID="friends-social-summary"
    >
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{summary.friendCount}</Text>
          <Text style={styles.metricLabel}>{t("friendsScreen.summaryFriendsLabel")}</Text>
        </View>
        {rankLine ? (
          <>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>#{summary.rank}</Text>
              <Text style={styles.metricLabel}>
                {mode === "week"
                  ? t("friendsScreen.summaryRankLabelWeek")
                  : t("friendsScreen.summaryRankLabelAll")}
              </Text>
            </View>
          </>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{summary.crewSessions}</Text>
          <Text style={styles.metricLabel}>{t("friendsScreen.summarySessionsLabel")}</Text>
        </View>
      </View>
      <Text style={styles.caption}>
        {rankLine ? `${rankLine} · ${sessionsLine}` : sessionsLine}
      </Text>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metric: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  caption: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    textAlign: "center",
    lineHeight: 18,
  },
});
