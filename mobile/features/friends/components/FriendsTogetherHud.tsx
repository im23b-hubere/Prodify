import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatTile } from "../../../components/ui/StatTile";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import type { BuddyStatusDto, CommitmentDto } from "../../../types/friends";

type Props = {
  t: TFunction;
  buddy: BuddyStatusDto | null;
  commitment: CommitmentDto | null;
  activeChallengeCount: number;
  onViewCommitment?: () => void;
};

export const FriendsTogetherHud = memo(function FriendsTogetherHud({
  t,
  buddy,
  commitment,
  activeChallengeCount,
  onViewCommitment,
}: Props) {
  const buddyLabel = useMemo(() => {
    if (buddy?.status === "active") {
      return buddy.buddy_username ?? "—";
    }
    if (buddy?.status === "pending_incoming" || buddy?.status === "pending_outgoing") {
      return t("friendsScreen.crewHudBuddyPending");
    }
    return t("friendsScreen.crewHudBuddyEmpty");
  }, [buddy, t]);

  const yourWeekSessions =
    buddy?.status === "active" ? String(buddy.this_week_sessions ?? 0) : "—";

  const commitmentLabel =
    commitment != null ? `${commitment.current_sessions ?? 0}/${commitment.target_sessions}` : "—";

  const statusLine = useMemo(() => {
    if (buddy?.status === "active") {
      const yours = buddy.this_week_sessions ?? 0;
      const theirs = buddy.buddy_week_sessions ?? 0;
      if (theirs > yours) return t("friendsScreen.crewHudBehindBuddy");
      if (yours > theirs) return t("friendsScreen.crewHudAheadBuddy");
      if (yours > 0) return t("friendsScreen.togetherBuddyTied");
    }
    if (activeChallengeCount > 0) {
      return t("friendsScreen.crewHudChallengesActive", { count: activeChallengeCount });
    }
    return t("friendsScreen.crewHudDefault");
  }, [activeChallengeCount, buddy, t]);

  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0a0a0a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="friends-together-hud"
    >
      <Text style={styles.eyebrow}>{t("friendsScreen.crewHudEyebrow")}</Text>
      <View style={styles.statGrid}>
        <StatTile label={t("friendsScreen.togetherBuddyTitle")} value={buddyLabel} />
        <StatTile
          label={t("friendsScreen.crewHudWeekLabel")}
          value={yourWeekSessions}
          accent={buddy?.status === "active"}
        />
        <StatTile label={t("friendsScreen.crewHudChallengesLabel")} value={`${activeChallengeCount}`} />
      </View>
      {commitment ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendsScreen.togetherViewInStats")}
          disabled={!onViewCommitment}
          onPress={onViewCommitment}
          style={({ pressed }) => [
            styles.commitmentRow,
            onViewCommitment && pressed && styles.commitmentRowPressed,
          ]}
          testID="friends-crew-commitment-row"
        >
          <Text style={styles.commitmentLabel}>{t("friendsScreen.togetherPromiseTitle")}</Text>
          <View style={styles.commitmentValueWrap}>
            <Text style={styles.commitmentValue}>{commitmentLabel}</Text>
            {onViewCommitment ? (
              <Text style={styles.commitmentLink}>{t("friendsScreen.togetherViewInStats")}</Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}
      <Text style={styles.status}>{statusLine}</Text>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  statGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  commitmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  commitmentRowPressed: {
    opacity: 0.88,
  },
  commitmentValueWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  commitmentLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  commitmentValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  commitmentLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  status: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    lineHeight: 18,
    textAlign: "center",
  },
});
