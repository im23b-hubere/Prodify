import { Calendar, Music2, Sparkles, Target } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type PlanRow = {
  key: string;
  icon: typeof Music2;
  label: string;
  value: string;
};

type Props = {
  rows: PlanRow[];
  insight: string;
  premiumLine: string;
};

export function OnboardingPlanSummary({ rows, insight, premiumLine }: Props) {
  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(320)} style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Sparkles color={colors.primary} size={22} />
        </View>
        <Text style={styles.insight}>{insight}</Text>
      </Animated.View>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const Icon = row.icon;
          const isLast = index === rows.length - 1;
          return (
            <Animated.View
              key={row.key}
              entering={FadeInDown.delay(80 + index * 60).duration(300)}
              style={[styles.row, isLast && styles.rowLast]}
            >
              <View style={styles.rowIcon}>
                <Icon color={colors.textSecondary} size={18} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={FadeInDown.delay(320).duration(300)} style={styles.premiumCard}>
        <Text style={styles.premiumLine}>{premiumLine}</Text>
      </Animated.View>
    </View>
  );
}

export const planRowIcons = { Music2, Target, Calendar };

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.28)",
    backgroundColor: "rgba(255,61,0,0.07)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  insight: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  rows: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  premiumCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumLine: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 21,
  },
});
