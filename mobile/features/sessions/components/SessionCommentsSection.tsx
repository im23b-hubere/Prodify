import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { SocialCommentDto } from "../../../types/friends";
import { styles } from "./SessionCommentsSection.styles";

type Props = {
  comments: SocialCommentDto[];
  input: string;
  loading: boolean;
  error: string | null;
  sending: boolean;
  highlightedCommentId: number | null;
  sentPulse: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
};

export function SessionCommentsSection(props: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("friendsScreen.commentsTitle")}</Text>
      <CommentsList
        comments={props.comments}
        loading={props.loading}
        highlightedCommentId={props.highlightedCommentId}
      />
      <View style={styles.commentComposerRow}>
        <TextInput
          value={props.input}
          onChangeText={props.onInputChange}
          placeholder={t("friendsScreen.commentPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={styles.commentInput}
          maxLength={400}
          onFocus={props.onFocus}
        />
        <CommentSubmitButton
          sending={props.sending}
          sentPulse={props.sentPulse}
          onSubmit={props.onSubmit}
        />
      </View>
      {props.error ? <Text style={styles.errorText}>{props.error}</Text> : null}
    </View>
  );
}

function CommentsList({
  comments,
  loading,
  highlightedCommentId,
}: Pick<Props, "comments" | "loading" | "highlightedCommentId">) {
  const { t } = useTranslation();
  if (loading) return <Text style={styles.mutedNote}>{t("friendsScreen.loading")}</Text>;
  if (comments.length === 0) {
    return <Text style={styles.mutedNote}>{t("friendsScreen.beFirstToComment")}</Text>;
  }
  return comments.map((comment) => (
    <CommentRow
      key={comment.id}
      comment={comment}
      highlighted={highlightedCommentId === comment.id}
    />
  ));
}

function CommentSubmitButton({
  sending,
  sentPulse,
  onSubmit,
}: Pick<Props, "sending" | "sentPulse" | "onSubmit">) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.commentSendButton,
        sentPulse && styles.commentSendButtonSuccess,
        pressed && styles.pressed,
      ]}
      disabled={sending}
      onPress={onSubmit}
    >
      <CommentSubmitContent sending={sending} sentPulse={sentPulse} />
    </Pressable>
  );
}

function CommentSubmitContent({ sending, sentPulse }: Pick<Props, "sending" | "sentPulse">) {
  const { t } = useTranslation();
  if (sending) {
    return <Text style={styles.commentSendText}>{t("friendsScreen.commentSendingShort")}</Text>;
  }
  if (sentPulse) return <Check size={16} color="#22c55e" strokeWidth={2.4} />;
  return <Text style={styles.commentSendText}>{t("friendsScreen.commentSend")}</Text>;
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
