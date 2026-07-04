import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
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
      <View style={styles.typePill}>
        <Text style={styles.typePillText} numberOfLines={1}>
          {typeLabel}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.duration}>{duration}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: ui.cardRadius,
    borderWidth: ui.cardBorderWidth,
    borderColor: "rgba(255,61,0,0.18)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScale }],
    borderColor: "rgba(255,61,0,0.32)",
  },
  typePill: {
    maxWidth: 108,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.4)",
    backgroundColor: "rgba(255,61,0,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typePillText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  duration: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  date: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  chevron: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 22,
    lineHeight: 24,
  },
});
