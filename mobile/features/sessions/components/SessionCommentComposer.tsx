import { ArrowUp, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";

const COMMENT_MAX_LENGTH = 400;

type Props = {
  value: string;
  sending: boolean;
  sentPulse: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
};

/** Message-style comment field pinned to the bottom, with the send button inside it. */
export function SessionCommentComposer({
  value,
  sending,
  sentPulse,
  onChange,
  onSubmit,
  onFocus,
}: Props) {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={styles.bar}>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          placeholder={t("friendsScreen.commentPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          maxLength={COMMENT_MAX_LENGTH}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendsScreen.commentSend")}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          hitSlop={8}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.send,
            canSend && styles.sendActive,
            sentPulse && styles.sendDone,
            pressed && styles.sendPressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : sentPulse ? (
            <Check color="#ffffff" size={16} strokeWidth={3} />
          ) : (
            <ArrowUp
              color={canSend ? "#ffffff" : colors.textSecondary}
              size={17}
              strokeWidth={2.8}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.background,
  },
  field: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 44,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingTop: 7,
    paddingBottom: 7,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 20,
  },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sendActive: {
    backgroundColor: colors.primary,
  },
  sendDone: {
    backgroundColor: "#22c55e",
  },
  sendPressed: {
    opacity: 0.85,
  },
});
