import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RankArt } from "../../../components/progression/RankArt";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { progressionLevelName } from "../../../lib/progressionLevels";
import { levelTierFor } from "../../../lib/progressionLevelTheme";

type Side = {
  level: number;
  label: string;
};

type Props = {
  you: Side;
  them: Side;
  friendName: string;
  onOpenPath: () => void;
};

/** XP rank head-to-head — separate from the session HeadToHeadCard. */
export function RankComparisonCard({ you, them, friendName, onOpenPath }: Props) {
  const { t } = useTranslation();
  const yourName = progressionLevelName(t, you.level);
  const theirName = progressionLevelName(t, them.level);
  const lead =
    you.level > them.level ? "you" : them.level > you.level ? "them" : "tied";

  return (
    <View style={styles.section} testID="friend-profile-rank-comparison">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("friendProfile.rankCompareTitle")}
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <RankSide
            side={you}
            name={yourName}
            caption={t("friendProfile.versusYou")}
            leading={lead === "you"}
          />
          <Text style={styles.vs}>{t("friendProfile.rankCompareVs")}</Text>
          <RankSide
            side={them}
            name={theirName}
            caption={friendName}
            leading={lead === "them"}
            alignEnd
          />
        </View>
        <Text style={styles.verdict}>
          {lead === "you"
            ? t("friendProfile.rankCompareVerdict.you")
            : lead === "them"
              ? t("friendProfile.rankCompareVerdict.them", { name: friendName })
              : t("friendProfile.rankCompareVerdict.tied")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendProfile.rankCompareOpenA11y")}
          onPress={onOpenPath}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          testID="friend-profile-rank-path-cta"
        >
          <Text style={styles.ctaLabel}>{t("friendProfile.rankCompareOpen")}</Text>
          <ChevronRight color={colors.primary} size={18} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

function RankSide({
  side,
  name,
  caption,
  leading,
  alignEnd,
}: {
  side: Side;
  name: string;
  caption: string;
  leading: boolean;
  alignEnd?: boolean;
}) {
  const tier = levelTierFor(side.level);
  return (
    <View style={[styles.side, alignEnd && styles.sideEnd]}>
      <RankArt level={side.level} size={44} />
      <Text
        style={[styles.level, leading && { color: tier.accent }]}
        numberOfLines={1}
      >
        {side.label}
      </Text>
      <Text style={styles.rankName} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.caption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  vs: {
    color: colors.textSecondary,
    fontFamily: fontFamily.heading,
    ...typography.caption,
    paddingTop: 18,
  },
  side: { flex: 1, gap: 4, alignItems: "flex-start" },
  sideEnd: { alignItems: "flex-end" },
  level: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.bodyStrong,
  },
  rankName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  caption: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  verdict: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  ctaPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  ctaLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodySmall,
  },
});
