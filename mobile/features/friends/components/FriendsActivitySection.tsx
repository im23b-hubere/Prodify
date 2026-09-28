import { Pressable, Text, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { LoadingState } from "../../../components/states/LoadingState";
import { spacing } from "../../../constants/theme";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsOverviewStyles as styles } from "../styles/friendsOverview.styles";

export function FriendsActivitySection({ props }: { props: FriendsOverviewProps }) {
  const trigger = props.activeTriggerCard;
  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader title={props.t("friendsScreen.sectionActivityTitle")} />
      {trigger ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={trigger.actionLabel}
          style={styles.triggerRow}
          onPress={() => {
            trigger.onPress();
            props.onCompleteTriggerAction();
          }}
        >
          <Text style={styles.triggerRowTitle} numberOfLines={1}>
            {trigger.title}
          </Text>
          <Text style={styles.triggerRowAction}>{trigger.actionLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.activityList}>
        {props.loading ? <LoadingState message={props.t("friendsScreen.loading")} /> : null}
        {props.activity.length === 0 && !props.loading ? (
          <EmptyState
            compact
            title={props.t("friendsScreen.activityFeedEmptyTitle")}
            message={props.t("friendsScreen.activityFeedEmptyMessage")}
          />
        ) : null}
        {props.activity.map((item, index) => (
          <View
            key={`${item.user_id}-${item.session_id}-${item.activity_at}`}
            style={index > 0 ? { marginTop: spacing.xs } : undefined}
          >
            {props.renderActivity(item, index)}
          </View>
        ))}
      </View>
    </View>
  );
}
