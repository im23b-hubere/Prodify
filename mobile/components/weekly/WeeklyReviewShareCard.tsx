import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { WeeklyReviewDto } from "../../types/outcomes";

type Props = {
  review: WeeklyReviewDto;
};

export const WeeklyReviewShareCard = memo(function WeeklyReviewShareCard({ review }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Prodify Weekly Outcome</Text>
      <Text style={styles.metric}>{review.total_sessions} sessions</Text>
      <Text style={styles.metric}>{(review.total_seconds / 3600).toFixed(1)} hours</Text>
      <Text style={styles.feedback} numberOfLines={3}>
        {review.ai_feedback}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 320,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  title: {
    color: colors.textSecondary,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metric: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  feedback: { color: colors.textSecondary, ...typography.body, marginTop: spacing.sm },
});
