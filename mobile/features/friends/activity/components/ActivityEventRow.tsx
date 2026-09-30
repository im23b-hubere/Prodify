import type { TFunction } from "i18next";
import { HeartCrack, Target } from "lucide-react-native";
import { memo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../../../constants/theme";
import type { FriendActivityDto } from "../../../../types/friends";
import { friendsActivityStyles as styles } from "../../styles/friendsActivity.styles";

type Props = {
  t: TFunction;
  item: FriendActivityDto;
  kind: "streak_broken" | "commitment";
  divided: boolean;
  /** Your own streak break has nothing to act on. */
  canAct: boolean;
  actionBusy: boolean;
  onSupportStreakBreak: (item: FriendActivityDto) => void;
  onViewCommitment: (item: FriendActivityDto) => void;
};

/** Quieter than a session row: an icon instead of a face, the message instead of stats. */
export const ActivityEventRow = memo(function ActivityEventRow({
  t,
  item,
  kind,
  divided,
  canAct,
  actionBusy,
  onSupportStreakBreak,
  onViewCommitment,
}: Props) {
  const isStreak = kind === "streak_broken";
  const Icon = isStreak ? HeartCrack : Target;
  const message = isStreak
    ? (item.event_message ?? t("friendsScreen.streakBrokenEventFallback"))
    : (item.event_message ?? t("friendsOverview.commitmentFallback"));
  const actionLabel = isStreak
    ? t("friendsScreen.supportStreakBreakCta")
    : t("friendsScreen.commitmentViewCta");
  return (
    <View
      style={styles.row}
      accessible={!canAct}
      accessibilityLabel={
        canAct
          ? undefined
          : t(
              isStreak
                ? "friendsScreen.activityStreakEventA11y"
                : "friendsScreen.activityCommitmentEventA11y",
              { name: item.username },
            )
      }
      testID={`friends-event-${item.user_id}-${item.activity_at}`}
    >
      {divided ? <View style={styles.rowDivider} /> : null}
      <View style={styles.eventIcon}>
        <Icon size={18} strokeWidth={2} color={colors.textSecondary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={2}>
          {message}
        </Text>
      </View>
      {canAct ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${item.username}`}
          accessibilityState={{ busy: actionBusy }}
          disabled={actionBusy}
          style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
          onPress={() => (isStreak ? onSupportStreakBreak(item) : onViewCommitment(item))}
        >
          {actionBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.textActionLabel}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
});
