import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { AppFlame, glyphRowStyle } from "../icons/ProdifyGlyphs";

import { GlassCard } from "../ui/GlassCard";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";

type Props = {
  yourStreak: number;
  theirStreak: number;
};

export const StreakComparison = memo(function StreakComparison({ yourStreak, theirStreak }: Props) {
  const { t } = useTranslation();
  const difference = theirStreak - yourStreak;
  const isAhead = difference > 0;

  let msg: string;
  if (isAhead) {
    msg = t("streakComparison.aheadThem", { count: difference });
  } else if (difference === 0) {
    msg = t("streakComparison.tied");
  } else {
    msg = t("streakComparison.aheadYou", { count: Math.abs(difference) });
  }

  return (
    <GlassCard>
      <View style={styles.inner}>
        <Text style={styles.title}>{t("streakComparison.title")}</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.lbl}>{t("streakComparison.you")}</Text>
            <View style={[glyphRowStyle, styles.valRow]}>
              <Text style={styles.val}>{yourStreak}</Text>
              <AppFlame size={16} />
            </View>
          </View>
          <Text style={styles.vs}>{t("streakComparison.vs")}</Text>
          <View style={styles.col}>
            <Text style={styles.lbl}>{t("streakComparison.them")}</Text>
            <View style={[glyphRowStyle, styles.valRow]}>
              <Text style={styles.val}>{theirStreak}</Text>
              <AppFlame size={16} />
            </View>
          </View>
        </View>
        <Text style={styles.msg}>{msg}</Text>
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  inner: { gap: spacing.md },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  col: { flex: 1, alignItems: "center", gap: 4 },
  lbl: { color: colors.textSecondary, ...typography.caption },
  val: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 28 },
  valRow: { justifyContent: "center" },
  vs: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    paddingHorizontal: spacing.sm,
  },
  msg: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
});
