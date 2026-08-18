import type { TFunction } from "i18next";
import { MessageCircle, ThumbsUp } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { FriendActivityDto } from "../../../types/friends";
import { friendsActivityStyles as styles } from "../styles/friendsActivity.styles";
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

export function FriendsActivityFeedItem(props: Props) {
  const streakBroken = props.item.status === "streak_broken";
  const commitment = props.item.status === "commitment_published";
  const eventCard = streakBroken || commitment;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(props.index, 8) * 40).duration(280)}
      style={styles.feedItemCard}
    >
      <View style={styles.feedItemAccent} />
      <View style={styles.feedItemInner}>
        <ActivityHeader props={props} streakBroken={streakBroken} commitment={commitment} />
        {!eventCard ? (
          <SessionActions props={props} />
        ) : (
          <EventActions props={props} streakBroken={streakBroken} />
        )}
      </View>
    </Animated.View>
  );
}

function ActivityHeader({
  props,
  streakBroken,
  commitment,
}: {
  props: Props;
  streakBroken: boolean;
  commitment: boolean;
}) {
  const { item, t } = props;
  const avatar = item.profile_picture_url?.trim()
    ? item.profile_picture_url.startsWith("http")
      ? item.profile_picture_url
      : `${API_BASE_URL}${item.profile_picture_url}`
    : null;
  const openable = item.session_id > 0 && (item.status === "live" || item.status === "completed");
  const labelKey = streakBroken
    ? "friendsScreen.activityStreakEventA11y"
    : commitment
      ? "friendsScreen.activityCommitmentEventA11y"
      : openable
        ? "friendsScreen.activityOpenSessionA11y"
        : "friendsScreen.activityCardA11y";
  const type = formatSessionTypeLabel(item.session_type, t);
  const metadata =
    streakBroken || commitment
      ? (item.event_message ?? t("friendsScreen.streakBrokenEventFallback"))
      : item.status === "live"
        ? t("friendsScreen.feedSessionMetaLive", { type, ago: formatTimeAgo(item.activity_at, t) })
        : t("friendsScreen.feedSessionMeta", {
            type,
            duration: formatDuration(item.duration_seconds ?? 0, t),
            ago: formatTimeAgo(item.activity_at, t),
          });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey, { name: item.username })}
      style={styles.feedHeaderRow}
      onPress={props.onOpenSession}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.feedAvatarImage} />
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
          <Text style={styles.feedSessionMeta}>
            {formatStreakStatusLabel(item.streak_status_key, item.streak_status_label, t)}
          </Text>
          {commitment ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.commitmentEventBadge}>
              <Text style={styles.commitmentEventBadgeText}>
                {t("friendsScreen.commitmentPublishedBadge")}
              </Text>
            </Animated.View>
          ) : null}
          {props.currentUserId === item.user_id ? (
            <View style={styles.feedYouPill}>
              <Text style={styles.feedYouPillText}>{t("friendsScreen.youPill")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.feedSessionMeta} numberOfLines={2}>
          {metadata}
        </Text>
      </View>
    </Pressable>
  );
}

function SessionActions({ props }: { props: Props }) {
  const { t } = props;
  const reactionLabel =
    props.reactionTotal > 0
      ? String(props.reactionTotal)
      : props.reactedByMe
        ? t("friendsScreen.reactedShort")
        : t("friendsScreen.reactShort");
  return (
    <View style={styles.feedActionsRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.activityReactionsA11y", {
          count: props.reactionTotal,
        })}
        style={({ pressed }) => [
          styles.feedReactPrimaryChip,
          props.reactedByMe && styles.feedReactPrimaryChipActive,
          pressed && { opacity: 0.88 },
        ]}
        disabled={props.reactionBusy}
        onPress={props.onToggleThumb}
        onLongPress={props.reactionTotal > 0 ? props.onOpenReactionUsers : undefined}
      >
        <ThumbsUp
          color={props.reactedByMe ? colors.textPrimary : colors.textSecondary}
          size={16}
          strokeWidth={2}
        />
        <Text
          style={[
            styles.feedReactPrimaryChipText,
            props.reactedByMe && styles.feedReactPrimaryChipTextActive,
          ]}
        >
          {reactionLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.activityCommentsA11y", { count: props.commentCount })}
        style={({ pressed }) => [styles.feedActionChip, pressed && styles.feedActionChipPressed]}
        onPress={props.onOpenSession}
      >
        <MessageCircle color={colors.textSecondary} size={16} strokeWidth={2} />
        <Text style={styles.feedActionChipText}>
          {t("friendsScreen.commentsCount", { count: props.commentCount })}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.feedOpenSessionA11y")}
        style={({ pressed }) => [styles.feedReplyChip, pressed && styles.feedReplyChipActive]}
        onPress={props.onOpenSession}
      >
        <Text style={styles.feedReplyChipText}>{t("friendsScreen.feedOpenSessionCta")}</Text>
      </Pressable>
    </View>
  );
}

function EventActions({ props, streakBroken }: { props: Props; streakBroken: boolean }) {
  const { t } = props;
  if (streakBroken && props.currentUserId === props.item.user_id)
    return (
      <View style={styles.feedActionsRow}>
        <Text style={styles.feedSessionMeta}>{t("friendsScreen.supportSelfNotAllowed")}</Text>
      </View>
    );
  return (
    <View style={styles.feedActionsRow}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.triggerActionPrimary,
          pressed && { opacity: 0.88 },
          pressed && !streakBroken && { transform: [{ scale: 0.98 }] },
        ]}
        onPress={streakBroken ? props.onSupportStreakBreak : props.onViewCommitment}
        disabled={streakBroken && props.supportBusy}
      >
        <Text style={styles.triggerActionTextPrimary}>
          {streakBroken
            ? props.supportBusy
              ? t("friendsScreen.loading")
              : t("friendsScreen.supportStreakBreakCta")
            : t("friendsScreen.commitmentViewCta")}
        </Text>
      </Pressable>
    </View>
  );
}
