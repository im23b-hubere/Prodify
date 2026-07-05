import { LinearGradient } from "expo-linear-gradient";
import { Share2, UserRound } from "lucide-react-native";
import type { TFunction } from "i18next";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

type Props = {
  t: TFunction;
  session: SessionDto;
  durationLabel: string;
  dateLine: string;
  isOwnSession: boolean;
  isActiveSession: boolean;
  producerDisplayName: string;
  focusScore: number | null;
  trackOutcomeLabel: string | null;
  onShareStory: () => void;
  onResumeActive: () => void;
  onOpenProfile: () => void;
};

export function SessionDetailHero({
  t,
  session,
  durationLabel,
  dateLine,
  isOwnSession,
  isActiveSession,
  producerDisplayName,
  focusScore,
  trackOutcomeLabel,
  onShareStory,
  onResumeActive,
  onOpenProfile,
}: Props) {
  const typeLabel = sessionTypeLabel(String(session.session_type), t);

  const onShareText = () => {
    const message = t("sessionDetail.shareSessionMessage", {
      type: typeLabel,
      duration: durationLabel,
    });
    Share.share({ message }).catch(() => undefined);
  };

  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0f0f0f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="session-detail-hero"
    >
      <View style={styles.badgeRow}>
        {!isOwnSession ? (
          <View style={styles.friendBadge}>
            <Text style={styles.friendBadgeText}>{t("sessionDetail.friendSessionBadge")}</Text>
          </View>
        ) : (
          <View style={styles.ownBadge}>
            <Text style={styles.ownBadgeText}>{t("sessionDetail.yourSessionBadge")}</Text>
          </View>
        )}
        {focusScore != null && focusScore > 0 ? (
          <View style={styles.focusBadge}>
            <Text style={styles.focusBadgeText}>
              {t("sessionDetail.focusBadge", { score: focusScore })}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.typeLabel}>{typeLabel}</Text>
      <Text style={styles.duration}>{durationLabel}</Text>
      <Text style={styles.meta}>{dateLine}</Text>

      {trackOutcomeLabel ? (
        <View style={styles.trackBlock}>
          <Text style={styles.trackLabel}>{trackOutcomeLabel}</Text>
          {session.track_title?.trim() ? (
            <Text style={styles.trackTitle}>{session.track_title.trim()}</Text>
          ) : null}
        </View>
      ) : null}

      {isActiveSession ? (
        <View style={styles.activeWrap} testID="session-detail-return-active">
          <PrimaryButton label={t("sessionDetail.returnToActive")} onPress={onResumeActive} />
        </View>
      ) : null}

      {!isOwnSession ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("sessionDetail.viewProfileA11y", { name: producerDisplayName })}
          style={({ pressed }) => [styles.producerLink, pressed && { opacity: 0.88 }]}
          onPress={onOpenProfile}
        >
          <UserRound color={colors.secondary} size={16} />
          <View style={styles.producerCopy}>
            <Text style={styles.producerName}>
              {t("sessionDetail.byProducer", { name: producerDisplayName })}
            </Text>
            <Text style={styles.producerCta}>{t("sessionDetail.viewProfile")}</Text>
          </View>
        </Pressable>
      ) : null}

      {!isActiveSession ? (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnPrimary,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("sessionDetail.shareSessionImage")}
            onPress={onShareStory}
          >
            <Share2 color="#fff" size={16} />
            <Text style={styles.actionBtnPrimaryText}>{t("sessionDetail.shareSessionImage")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={t("sessionDetail.shareSession")}
            onPress={onShareText}
          >
            <Text style={styles.actionBtnText}>{t("sessionDetail.shareSession")}</Text>
          </Pressable>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  friendBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(162,89,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
  },
  friendBadgeText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  ownBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,61,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.35)",
  },
  ownBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  focusBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  focusBadgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  typeLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  duration: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 40,
    lineHeight: 44,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 18,
  },
  trackBlock: {
    marginTop: spacing.xs,
    gap: 2,
  },
  trackLabel: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  trackTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  activeWrap: {
    marginTop: spacing.sm,
  },
  producerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  producerCopy: {
    flex: 1,
    gap: 2,
  },
  producerName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  producerCta: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionBtnPrimaryText: {
    color: "#fff",
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
