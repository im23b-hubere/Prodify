import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type ReturnHookCardProps = {
  summaryLine: string | null;
  momentumState: string;
  momentumScore: number;
};

export function ReturnHookCard({ summaryLine, momentumState, momentumScore }: ReturnHookCardProps) {
  const { t } = useTranslation();
  if (!summaryLine) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("dashboard.returnHookTitle")}</Text>
      <Text style={styles.text}>{summaryLine}</Text>
      <Text style={styles.text}>
        {t("dashboard.returnHookMomentum", {
          state: momentumState.toUpperCase(),
          score: momentumScore,
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  text: { color: colors.textSecondary, ...typography.caption },
});
