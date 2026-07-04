import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, spacing, typography, ui } from "../../constants/theme";
import { formatSessionListDate } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

function formatDurationCompact(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0;
  const mins = Math.max(1, Math.round(safe / 60));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

type Props = {
  session: SessionDto;
  typeLabel: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
};

export const DashboardRecentSessionRow = memo(function DashboardRecentSessionRow({
  session,
  typeLabel,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: Props) {
  const duration = formatDurationCompact(session.duration_seconds ?? 0);
  const dateLabel = formatSessionListDate(session.started_at);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
    >
      <View style={styles.copy}>
        <Text style={styles.typeLabel}>{typeLabel}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.duration}>{duration}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: ui.cardRadius,
    borderWidth: ui.cardBorderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScale }],
    borderColor: "rgba(255,255,255,0.16)",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  typeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    flexShrink: 1,
  },
  date: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  duration: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  chevron: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
    lineHeight: 24,
  },
});
