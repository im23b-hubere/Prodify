import { SmilePlus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import type { SocialReactionDto } from "../../../types/friends";
import { EmojiPickerSheet } from "./EmojiPickerSheet";

/** One-tap reactions that are always offered, even before anyone has reacted. */
export const QUICK_REACTIONS = ["🔥", "👏", "💯", "🎯", "🚀"] as const;

type Props = {
  reactions: SocialReactionDto[];
  loading: boolean;
  error: string | null;
  busyEmoji: string | null;
  onToggle: (emoji: string) => void;
};

/**
 * Reactions sit directly under the session, like on a post: the quick picks, any other emoji
 * friends used, and a button that opens the full picker.
 */
export function SessionReactionBar({ reactions, loading, error, busyEmoji, onToggle }: Props) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const quick = new Set<string>(QUICK_REACTIONS);
  const custom = reactions
    .filter((reaction) => !quick.has(reaction.emoji) && reaction.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((reaction) => reaction.emoji);
  const emojis = [...QUICK_REACTIONS, ...custom];

  return (
    <View style={styles.wrap} testID="session-reaction-bar">
      <View style={styles.row}>
        {emojis.map((emoji) => {
          const reaction = reactions.find((item) => item.emoji === emoji);
          const count = reaction?.count ?? 0;
          const active = Boolean(reaction?.reacted_by_me);
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={loading || Boolean(busyEmoji)}
              onPress={() => onToggle(emoji)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
              {count > 0 ? (
                <Text style={[styles.count, active && styles.countActive]}>{count}</Text>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sessionDetail.addReactionA11y")}
          disabled={loading || Boolean(busyEmoji)}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.pressed]}
        >
          <SmilePlus color={colors.textSecondary} size={18} strokeWidth={2} />
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <EmojiPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(emoji) => {
          // Picking an emoji you already reacted with would remove it; a picker should only add.
          const mine = reactions.find((item) => item.emoji === emoji)?.reacted_by_me;
          if (!mine) onToggle(emoji);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    minWidth: 44,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  addChip: {
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.8,
  },
  emoji: {
    fontSize: 17,
  },
  count: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 16,
  },
  countActive: {
    color: colors.textPrimary,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
});
