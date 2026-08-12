import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { SocialCommentDto, SocialReactionDto } from "../../../types/friends";

const DEFAULT_REACTIONS = ["🔥", "👏", "💯", "🎯", "🚀"] as const;

type SessionSocialSectionsProps = {
  comments: SocialCommentDto[];
  commentInput: string;
  commentsLoading: boolean;
  commentsError: string | null;
  commentSending: boolean;
  reactions: SocialReactionDto[];
  reactionsLoading: boolean;
  reactionsError: string | null;
  reactionBusyEmoji: string | null;
  highlightedCommentId: number | null;
  commentSentPulse: boolean;
  onCommentInputChange: (value: string) => void;
  onCommentSubmit: () => void;
  onCommentFocus: () => void;
  onReactionToggle: (emoji: string) => void;
};

export function SessionSocialSections({
  comments,
  commentInput,
  commentsLoading,
  commentsError,
  commentSending,
  reactions,
  reactionsLoading,
  reactionsError,
  reactionBusyEmoji,
  highlightedCommentId,
  commentSentPulse,
  onCommentInputChange,
  onCommentSubmit,
  onCommentFocus,
  onReactionToggle,
}: SessionSocialSectionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("friendsScreen.reactionsTitle")}</Text>
        {reactionsLoading ? (
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
                  disabled={Boolean(reactionBusyEmoji)}
                  onPress={() => onReactionToggle(emoji)}
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
        {reactionsError ? <Text style={styles.errorText}>{reactionsError}</Text> : null}
        {!reactionsLoading && reactions.length === 0 ? (
          <Text style={styles.mutedNote}>{t("friendsScreen.noReactionsYet")}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("friendsScreen.commentsTitle")}</Text>
        {commentsLoading ? (
          <Text style={styles.mutedNote}>{t("friendsScreen.loading")}</Text>
        ) : comments.length === 0 ? (
          <Text style={styles.mutedNote}>{t("friendsScreen.beFirstToComment")}</Text>
        ) : (
          comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              highlighted={highlightedCommentId === comment.id}
            />
          ))
        )}
        <View style={styles.commentComposerRow}>
          <TextInput
            value={commentInput}
            onChangeText={onCommentInputChange}
            placeholder={t("friendsScreen.commentPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={styles.commentInput}
            maxLength={400}
            onFocus={onCommentFocus}
          />
          <Pressable
            style={({ pressed }) => [
              styles.commentSendButton,
              commentSentPulse && styles.commentSendButtonSuccess,
              pressed && styles.pressed,
            ]}
            disabled={commentSending}
            onPress={onCommentSubmit}
          >
            {commentSending ? (
              <Text style={styles.commentSendText}>{t("friendsScreen.commentSendingShort")}</Text>
            ) : commentSentPulse ? (
              <Check size={16} color="#22c55e" strokeWidth={2.4} />
            ) : (
              <Text style={styles.commentSendText}>{t("friendsScreen.commentSend")}</Text>
            )}
          </Pressable>
        </View>
        {commentsError ? <Text style={styles.errorText}>{commentsError}</Text> : null}
      </View>
    </>
  );
}

function CommentRow({ comment, highlighted }: { comment: SocialCommentDto; highlighted: boolean }) {
  const { t } = useTranslation();
  const pulse = useSharedValue(highlighted ? 1 : 0);

  useEffect(() => {
    if (!highlighted) {
      pulse.value = 0;
      return;
    }
    pulse.value = 1;
    pulse.value = withDelay(120, withTiming(0, { duration: 1200 }));
  }, [highlighted, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pulse.value,
      [0, 1],
      ["rgba(255,255,255,0.03)", "rgba(255,61,0,0.16)"],
    ),
    borderColor: interpolateColor(pulse.value, [0, 1], [colors.border, "rgba(255,61,0,0.5)"]),
  }));
  const avatarUri = resolveAvatarUri(comment.author_profile_picture_url);
  return (
    <Animated.View style={[styles.commentItem, animatedStyle]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.commentAvatarImage} />
      ) : (
        <View style={styles.commentAvatarFallback}>
          <Text style={styles.commentAvatarInitials}>
            {comment.author_username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.commentContent}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentAuthor}>{comment.author_username}</Text>
          <Text style={styles.commentTime}>{formatCommentTime(comment.created_at, t)}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
    </Animated.View>
  );
}

function resolveAvatarUri(uri?: string | null): string | null {
  if (!uri?.trim()) return null;
  return uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`;
}

function formatCommentTime(iso: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const normalizedIso = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`;
  return formatTimeAgo(normalizedIso, t);
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
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitials: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  commentContent: { flex: 1, gap: 4 },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  commentTime: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    fontSize: 11,
  },
  commentBody: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  commentComposerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    textAlignVertical: "center",
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  commentSendButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255,61,0,0.12)",
    minWidth: 52,
    alignItems: "center",
  },
  commentSendButtonSuccess: {
    backgroundColor: "rgba(34,197,94,0.16)",
    borderColor: "rgba(34,197,94,0.8)",
  },
  commentSendText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
