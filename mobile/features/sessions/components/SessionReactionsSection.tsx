import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import type { SocialReactionDto } from "../../../types/friends";

export const DEFAULT_REACTIONS = ["🔥", "👏", "💯", "🎯", "🚀"] as const;

type Props = {
  reactions: SocialReactionDto[];
  loading: boolean;
  error: string | null;
  busyEmoji: string | null;
  onToggle: (emoji: string) => void;
};

export function SessionReactionsSection({ reactions, loading, error, busyEmoji, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("friendsScreen.reactionsTitle")}</Text>
      {loading ? (
        <Text style={styles.mutedNote}>{t("friendsScreen.loading")}</Text>
      ) : (
        <View style={styles.reactionRow}>
          {DEFAULT_REACTIONS.map((emoji) => {
            const reaction = reactions.find((item) => item.emoji === emoji);
            const active = Boolean(reaction?.reacted_by_me);
            return (
              <Pressable
                key={emoji}
                style={({ pressed }) => [
                  styles.reactionChip,
                  active && styles.reactionChipActive,
                  pressed && styles.pressed,
                ]}
                disabled={Boolean(busyEmoji)}
                onPress={() => onToggle(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionCount, active && styles.reactionCountActive]}>
                  {reaction?.count ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && reactions.length === 0 ? (
        <Text style={styles.mutedNote}>{t("friendsScreen.noReactionsYet")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  pressed: { opacity: 0.9 },
  reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  reactionCountActive: { color: colors.textPrimary },
});
