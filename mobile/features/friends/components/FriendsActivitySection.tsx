import { Activity } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { LoadingState } from "../../../components/states/LoadingState";
import { colors, spacing } from "../../../constants/theme";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsOverviewStyles as styles } from "../styles/friendsOverview.styles";

export function FriendsActivitySection({ props }: { props: FriendsOverviewProps }) {
  const trigger = props.activeTriggerCard;
  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader
        icon={<Activity color={colors.primary} size={20} />}
        title={props.t("friendsScreen.sectionActivityTitle")}
        subtitle={props.t("friendsScreen.sectionActivitySub")}
        right={
          props.activity.length > 0 ? (
            <View style={styles.activityCountPill}>
              <Text style={styles.activityCountText}>{props.activity.length}</Text>
            </View>
          ) : null
        }
      />
      {trigger ? (
        <View style={styles.cardElevated}>
          <View key={trigger.key} style={styles.triggerCardPrimary}>
            <Text style={styles.userName}>{trigger.title}</Text>
            <Pressable
              style={styles.triggerActionPrimary}
              onPress={() => {
                trigger.onPress();
                props.onCompleteTriggerAction();
              }}
            >
              <Text style={styles.triggerActionTextPrimary}>{trigger.actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.activityFeedStack}>
        {props.loading ? <LoadingState message={props.t("friendsScreen.loading")} /> : null}
        {props.activity.length === 0 && !props.loading ? (
          <EmptyState
            compact
            iconNode={<Activity color={colors.primary} size={32} />}
            title={props.t("friendsScreen.activityFeedEmptyTitle")}
            message={props.t("friendsScreen.activityFeedEmptyMessage")}
          />
        ) : null}
        {props.activity.length > 0 ? (
          <View style={styles.activityFeedStack}>
            {props.activity.map((item, index) => (
              <View
                key={`${item.user_id}-${item.session_id}-${item.activity_at}`}
                style={index > 0 ? { marginTop: spacing.sm } : undefined}
              >
                {props.renderActivity(item, index)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
