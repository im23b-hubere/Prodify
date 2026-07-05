import type { TFunction } from "i18next";
import { MessageCircle, ThumbsUp } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { FriendActivityDto } from "../../../types/friends";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";
import {
  formatDuration,
  formatSessionTypeLabel,
  formatStreakStatusLabel,
} from "../utils/friendsScreenFormat";

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
  onSupportStreakBreak?: () => void;
  onViewCommitment?: () => void;
  supportBusy?: boolean;
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
  onSupportStreakBreak,
  onViewCommitment,
  supportBusy = false,
}: Props) {
  const avatarUri = item.profile_picture_url?.trim()
    ? item.profile_picture_url.startsWith("http")
      ? item.profile_picture_url
      : `${API_BASE_URL}${item.profile_picture_url}`
    : null;
  const typeLabel = formatSessionTypeLabel(item.session_type, t);
  const streakStatus = formatStreakStatusLabel(item.streak_status_key, item.streak_status_label, t);
  const isStreakBroken = item.status === "streak_broken";
  const isCommitmentPublished = item.status === "commitment_published";
  const isEventCard = isStreakBroken || isCommitmentPublished;
  const isOpenableSession =
    item.session_id > 0 && (item.status === "live" || item.status === "completed");
  const headerA11y = isStreakBroken
    ? t("friendsScreen.activityStreakEventA11y", { name: item.username })
    : isCommitmentPublished
      ? t("friendsScreen.activityCommitmentEventA11y", { name: item.username })
      : isOpenableSession
        ? t("friendsScreen.activityOpenSessionA11y", { name: item.username })
        : t("friendsScreen.activityCardA11y", { name: item.username });
  const reactionLabel =
    reactionTotal > 0
      ? String(reactionTotal)
      : reactedByMe
        ? t("friendsScreen.reactedShort")
        : t("friendsScreen.reactShort");

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280)}
      style={styles.feedItemCard}
    >
      <View style={styles.feedItemAccent} />
      <View style={styles.feedItemInner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={headerA11y}
          style={styles.feedHeaderRow}
          onPress={onOpenSession}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.feedAvatarImage} />
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
              <Text style={styles.feedSessionMeta}>{streakStatus}</Text>
              {isCommitmentPublished ? (
                <Animated.View entering={FadeIn.duration(220)} style={styles.commitmentEventBadge}>
                  <Text style={styles.commitmentEventBadgeText}>
                    {t("friendsScreen.commitmentPublishedBadge")}
                  </Text>
                </Animated.View>
              ) : null}
              {currentUserId === item.user_id ? (
                <View style={styles.feedYouPill}>
                  <Text style={styles.feedYouPillText}>{t("friendsScreen.youPill")}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.feedSessionMeta} numberOfLines={2}>
              {isEventCard
                ? (item.event_message ?? t("friendsScreen.streakBrokenEventFallback"))
                : item.status === "live"
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

        {!isEventCard ? (
          <View style={styles.feedActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("friendsScreen.activityReactionsA11y", {
                count: reactionTotal,
              })}
              style={({ pressed }) => [
                styles.feedReactPrimaryChip,
                reactedByMe && styles.feedReactPrimaryChipActive,
                pressed && { opacity: 0.88 },
              ]}
              disabled={reactionBusy}
              onPress={onToggleThumb}
              onLongPress={reactionTotal > 0 ? onOpenReactionUsers : undefined}
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
                {reactionLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("friendsScreen.activityCommentsA11y", {
                count: commentCount,
              })}
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
              accessibilityLabel={t("friendsScreen.feedOpenSessionA11y")}
              style={({ pressed }) => [styles.feedReplyChip, pressed && styles.feedReplyChipActive]}
              onPress={onOpenSession}
            >
              <Text style={styles.feedReplyChipText}>{t("friendsScreen.feedOpenSessionCta")}</Text>
            </Pressable>
          </View>
        ) : isStreakBroken ? (
          <View style={styles.feedActionsRow}>
            {currentUserId === item.user_id ? (
              <Text style={styles.feedSessionMeta}>{t("friendsScreen.supportSelfNotAllowed")}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.triggerActionPrimary, pressed && { opacity: 0.88 }]}
                onPress={onSupportStreakBreak}
                disabled={supportBusy}
              >
                <Text style={styles.triggerActionTextPrimary}>
                  {supportBusy
                    ? t("friendsScreen.loading")
                    : t("friendsScreen.supportStreakBreakCta")}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.feedActionsRow}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.triggerActionPrimary,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onViewCommitment}
            >
              <Text style={styles.triggerActionTextPrimary}>
                {t("friendsScreen.commitmentViewCta")}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
