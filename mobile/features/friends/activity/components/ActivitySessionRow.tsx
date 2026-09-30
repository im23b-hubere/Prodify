import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { ThumbsUp } from "lucide-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { colors } from "../../../../constants/theme";
import type { FriendActivityDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import { friendsActivityStyles as styles } from "../../styles/friendsActivity.styles";
import { formatDuration, formatSessionTypeLabel } from "../../utils/friendsScreenFormat";
import { formatActivityTime } from "../activityTime";

const AVATAR_SIZE = 40;

type Props = {
  t: TFunction;
  item: FriendActivityDto;
  divided: boolean;
  reactionTotal: number;
  commentCount: number;
  reactedByMe: boolean;
  reactionBusy: boolean;
  onOpenSession: (item: FriendActivityDto) => void;
  onToggleThumb: (item: FriendActivityDto) => void;
  onOpenReactionUsers: (item: FriendActivityDto) => void;
};

export const ActivitySessionRow = memo(function ActivitySessionRow({
  t,
  item,
  divided,
  reactionTotal,
  commentCount,
  reactedByMe,
  reactionBusy,
  onOpenSession,
  onToggleThumb,
  onOpenReactionUsers,
}: Props) {
  const type = formatSessionTypeLabel(item.session_type, t);
  const duration = formatDuration(item.duration_seconds ?? 0, t);
  const comments =
    commentCount > 0 ? t("friendsOverview.commentCount", { count: commentCount }) : null;
  const meta = [type, duration, comments].filter(Boolean).join(" · ");
  const time = formatActivityTime(item.activity_at);
  const toggleThumb = () => {
    if (reactionBusy) return;
    Haptics.selectionAsync().catch(() => undefined);
    onToggleThumb(item);
  };
  const accessibilityActions = [
    {
      name: "react",
      label: t(reactedByMe ? "friendsOverview.unreactAction" : "friendsOverview.reactAction"),
    },
    ...(reactionTotal > 0
      ? [{ name: "reactions", label: t("friendsOverview.showReactionsAction") }]
      : []),
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("friendsOverview.sessionRowA11y", {
        name: item.username,
        meta,
        time,
        reactions: t("friendsScreen.activityReactionsA11y", { count: reactionTotal }),
      })}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "react") toggleThumb();
        if (event.nativeEvent.actionName === "reactions") onOpenReactionUsers(item);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onOpenSession(item)}
      testID={`friends-activity-${item.session_id}`}
    >
      {divided ? <View style={styles.rowDivider} /> : null}
      <Avatar
        name={item.username}
        photoUri={profilePictureUrl(item.profile_picture_url)}
        size={AVATAR_SIZE}
      />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.rowAside}>
        <Text style={styles.time}>{time}</Text>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          hitSlop={8}
          disabled={reactionBusy}
          style={({ pressed }) => [
            styles.reaction,
            reactedByMe && styles.reactionActive,
            pressed && styles.textActionPressed,
          ]}
          onPress={toggleThumb}
          onLongPress={reactionTotal > 0 ? () => onOpenReactionUsers(item) : undefined}
          testID={`friends-activity-react-${item.session_id}`}
        >
          <ThumbsUp
            size={14}
            strokeWidth={2}
            color={reactedByMe ? colors.primary : colors.textSecondary}
          />
          {reactionTotal > 0 ? (
            <Text style={[styles.reactionCount, reactedByMe && styles.reactionCountActive]}>
              {reactionTotal}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </Pressable>
  );
});
