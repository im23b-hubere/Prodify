import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "../ui/GlassCard";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";

type Props = {
  yourStreak: number;
  theirStreak: number;
};

export const StreakComparison = memo(function StreakComparison({ yourStreak, theirStreak }: Props) {
  const difference = theirStreak - yourStreak;
  const isAhead = difference > 0;

  let msg: string;
  if (isAhead) {
    msg = `They're ${difference} day${difference === 1 ? "" : "s"} ahead — time to catch up.`;
  } else if (difference === 0) {
    msg = "You're tied — keep pushing together.";
  } else {
    msg = `You're ${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"} ahead — don't slow down.`;
  }

  return (
    <GlassCard>
      <View style={styles.inner}>
        <Text style={styles.title}>Streak comparison</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.lbl}>You</Text>
            <Text style={styles.val}>
              {yourStreak}
              <Text> 🔥</Text>
            </Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.col}>
            <Text style={styles.lbl}>Them</Text>
            <Text style={styles.val}>
              {theirStreak}
              <Text> 🔥</Text>
            </Text>
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
  vs: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, paddingHorizontal: spacing.sm },
  msg: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
});
