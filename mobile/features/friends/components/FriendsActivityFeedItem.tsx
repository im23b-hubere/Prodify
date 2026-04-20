import type { TFunction } from "i18next";
import { MessageCircle, ThumbsUp } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { FriendActivityDto } from "../../../types/friends";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";
import { formatDuration, formatSessionTypeLabel } from "../utils/friendsScreenFormat";

type Props = {
  item: FriendActivityDto;
  index: number;
  reactionTotal: number;
  commentCount: number;
  reactedByMe: boolean;
  reactionBusy: boolean;
  currentUserId?: number;
  t: TFunction;
  onOpenSession: () => void;
  onToggleThumb: () => void;
  onOpenReactionUsers: () => void;
};

export function FriendsActivityFeedItem({
  item,
  index,
  reactionTotal,
  commentCount,
  reactedByMe,
  reactionBusy,
  currentUserId,
  t,
  onOpenSession,
  onToggleThumb,
  onOpenReactionUsers,
}: Props) {
  const typeLabel = formatSessionTypeLabel(item.session_type, t);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280)}
      style={styles.feedItemCard}
    >
      <View style={styles.feedItemAccent} />
      <View style={styles.feedItemInner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendsScreen.activityOpenSessionA11y", { name: item.username })}
          style={styles.feedHeaderRow}
          onPress={onOpenSession}
        >
          {item.profile_picture_url ? (
            <Image source={{ uri: item.profile_picture_url }} style={styles.feedAvatarImage} />
          ) : (
            <View style={styles.feedAvatar}>
              <Text style={styles.feedAvatarText}>{item.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.feedHeaderCopy}>
            <View style={styles.feedNameRow}>
              <Text style={[styles.feedUserName, styles.feedUserNameFlex]} numberOfLines={1}>
                {item.username}
              </Text>
              {currentUserId === item.user_id ? (
                <View style={styles.feedYouPill}>
                  <Text style={styles.feedYouPillText}>{t("friendsScreen.youPill")}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.feedSessionMeta} numberOfLines={2}>
              {item.status === "live"
                ? t("friendsScreen.feedSessionMetaLive", {
                    type: typeLabel,
                    ago: formatTimeAgo(item.activity_at, t),
                  })
                : t("friendsScreen.feedSessionMeta", {
                    type: typeLabel,
                    duration: formatDuration(item.duration_seconds ?? 0, t),
                    ago: formatTimeAgo(item.activity_at, t),
                  })}
            </Text>
          </View>
        </Pressable>

        <View style={styles.feedActionsRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.feedReactPrimaryChip,
              reactedByMe && styles.feedReactPrimaryChipActive,
              pressed && { opacity: 0.88 },
            ]}
            disabled={reactionBusy}
            onPress={onToggleThumb}
          >
            <ThumbsUp
              color={reactedByMe ? colors.textPrimary : colors.textSecondary}
              size={16}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.feedReactPrimaryChipText,
                reactedByMe && styles.feedReactPrimaryChipTextActive,
              ]}
            >
              {reactedByMe ? t("friendsScreen.reactedShort") : t("friendsScreen.reactShort")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.activityReactionsA11y", { count: reactionTotal })}
            style={({ pressed }) => [
              styles.feedActionChip,
              pressed && styles.feedActionChipPressed,
            ]}
            onPress={onOpenReactionUsers}
          >
            <ThumbsUp color={colors.textSecondary} size={16} strokeWidth={2} />
            <Text style={styles.feedActionChipText}>
              {t("friendsScreen.reactionsCount", { count: reactionTotal })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.activityCommentsA11y", { count: commentCount })}
            style={({ pressed }) => [
              styles.feedActionChip,
              pressed && styles.feedActionChipPressed,
            ]}
            onPress={onOpenSession}
          >
            <MessageCircle color={colors.textSecondary} size={16} strokeWidth={2} />
            <Text style={styles.feedActionChipText}>
              {t("friendsScreen.commentsCount", { count: commentCount })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.feedReplyChip, pressed && { opacity: 0.88 }]}
            onPress={onOpenSession}
          >
            <Text style={styles.feedReplyChipText}>{t("friendsScreen.openSessionComments")}</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.feedThreadLink, pressed && { opacity: 0.85 }]}
          onPress={onOpenSession}
        >
          <Text style={styles.viewAllComments}>
            {commentCount > 0
              ? t("friendsScreen.viewCommentsCount", { count: commentCount })
              : t("friendsScreen.beFirstToComment")}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
