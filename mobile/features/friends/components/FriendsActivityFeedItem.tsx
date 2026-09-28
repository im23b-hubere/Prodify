import type { TFunction } from "i18next";
import { MessageCircle, ThumbsUp } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";

import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import { formatTimeAgo } from "../../../lib/timeAgo";
import type { FriendActivityDto } from "../../../types/friends";
import { friendsActivityStyles as styles } from "../styles/friendsActivity.styles";
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
  onSupportStreakBreak?: () => void;
  onViewCommitment?: () => void;
  supportBusy?: boolean;
};

export function FriendsActivityFeedItem(props: Props) {
  const streakBroken = props.item.status === "streak_broken";
  const commitment = props.item.status === "commitment_published";
  const eventCard = streakBroken || commitment;
  return (
    <View style={styles.feedRow}>
      <ActivityBody props={props} streakBroken={streakBroken} commitment={commitment} />
      {eventCard ? (
        <EventAction props={props} streakBroken={streakBroken} />
      ) : (
        <SessionActions props={props} />
      )}
    </View>
  );
}

function ActivityBody({
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
      style={styles.feedMain}
      onPress={props.onOpenSession}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.feedAvatarImage} />
      ) : (
        <View style={styles.feedAvatar}>
          <Text style={styles.feedAvatarText}>{item.username.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.feedCopy}>
        <Text style={styles.feedUserName} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={styles.feedSessionMeta} numberOfLines={1}>
          {metadata}
        </Text>
      </View>
    </Pressable>
  );
}

function SessionActions({ props }: { props: Props }) {
  const { t } = props;
  return (
    <View style={styles.feedActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.activityReactionsA11y", {
          count: props.reactionTotal,
        })}
        style={styles.feedIconButton}
        disabled={props.reactionBusy}
        onPress={props.onToggleThumb}
        onLongPress={props.reactionTotal > 0 ? props.onOpenReactionUsers : undefined}
      >
        <ThumbsUp
          color={props.reactedByMe ? colors.primary : colors.textSecondary}
          size={16}
          strokeWidth={2}
        />
        {props.reactionTotal > 0 ? (
          <Text style={[styles.feedIconCount, props.reactedByMe && styles.feedIconCountActive]}>
            {props.reactionTotal}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.activityCommentsA11y", { count: props.commentCount })}
        style={styles.feedIconButton}
        onPress={props.onOpenSession}
      >
        <MessageCircle color={colors.textSecondary} size={16} strokeWidth={2} />
        {props.commentCount > 0 ? (
          <Text style={styles.feedIconCount}>{props.commentCount}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function EventAction({ props, streakBroken }: { props: Props; streakBroken: boolean }) {
  const { t } = props;
  if (streakBroken && props.currentUserId === props.item.user_id) return null;
  const label = streakBroken
    ? props.supportBusy
      ? t("friendsScreen.loading")
      : t("friendsScreen.supportStreakBreakCta")
    : t("friendsScreen.commitmentViewCta");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.feedEventAction}
      onPress={streakBroken ? props.onSupportStreakBreak : props.onViewCommitment}
      disabled={streakBroken && props.supportBusy}
    >
      <Text style={styles.feedEventActionText}>{label}</Text>
    </Pressable>
  );
}
