import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "../ui/GlassCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  greeting: string;
  userName: string;
  message: string;
  /** Optional line from `GET /motivational-messages/random` (translated). */
  serverMessage?: string | null;
  todaySessionCount: number;
};

export const DashboardMotivationCard = memo(function DashboardMotivationCard({
  greeting,
  userName,
  message,
  serverMessage,
  todaySessionCount,
}: Props) {
  const { t } = useTranslation();
  const motivationLine = serverMessage?.trim() ? serverMessage : message;

  return (
    <GlassCard>
      <View style={styles.inner}>
        <Text style={styles.greeting}>
          {greeting}, {userName}! 👋
        </Text>
        <Text style={styles.motivationText}>{motivationLine}</Text>
        {todaySessionCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t("motivationCard.sessionsToday", { count: todaySessionCount })}
            </Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  inner: { gap: spacing.sm },
  greeting: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  motivationText: {
    color: colors.textSecondary,
    ...typography.body,
    lineHeight: 22,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,106,61,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,106,61,0.35)",
  },
  badgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
