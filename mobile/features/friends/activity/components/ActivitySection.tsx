import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ListSection } from "../../../../components/ui/list/ListSection";
import { useNow } from "../../../../hooks/useNow";
import type { FriendActivityDto } from "../../../../types/friends";
import type { RenderActivity } from "../../hooks/useFriendsActivityRenderer";
import { friendsActivityStyles as styles } from "../../styles/friendsActivity.styles";
import { formatActivityDay } from "../activityTime";
import { type ActivityDay, groupActivityByDay, previewActivity } from "../friendsActivityFeed";

type Props = {
  t: TFunction;
  activity: FriendActivityDto[];
  renderActivity: RenderActivity;
  onStartSession: () => void;
};

export function ActivitySection({ t, activity, renderActivity, onStartSession }: Props) {
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const { items, hiddenCount } = useMemo(
    () => previewActivity(activity, expanded),
    [activity, expanded],
  );
  const days = useMemo(() => groupActivityByDay(items, now), [items, now]);
  const isCollapsible = expanded || hiddenCount > 0;
  return (
    <ListSection
      title={t("friendsScreen.sectionActivityTitle")}
      carded={false}
      testID="friends-activity"
    >
      {days.length === 0 ? (
        <View style={[styles.card, styles.empty]} testID="friends-activity-empty">
          <Text style={styles.rowTitle}>{t("friendsScreen.activityFeedEmptyTitle")}</Text>
          <Text style={styles.emptyMessage}>{t("friendsScreen.activityFeedEmptyMessage")}</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
            onPress={onStartSession}
            testID="friends-activity-empty-cta"
          >
            <Text style={styles.textActionLabel}>{t("friendsOverview.activityEmptyCta")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.days}>
          {days.map((day) => (
            <View key={day.key} style={styles.day}>
              <Text style={styles.dayLabel} accessibilityRole="header">
                {dayLabel(day, t)}
              </Text>
              <View style={styles.card}>
                {day.items.map((item, index) => (
                  <View key={`${item.user_id}-${item.session_id}-${item.activity_at}`}>
                    {renderActivity(item, index > 0)}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
      {isCollapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={({ pressed }) => [
            styles.textAction,
            styles.showMore,
            pressed && styles.textActionPressed,
          ]}
          onPress={() => setExpanded((value) => !value)}
          testID="friends-activity-toggle"
        >
          <Text style={styles.textActionLabel}>
            {expanded
              ? t("friendsOverview.showLess")
              : t("friendsOverview.showMoreActivity", { count: hiddenCount })}
          </Text>
        </Pressable>
      ) : null}
    </ListSection>
  );
}

function dayLabel(day: ActivityDay, t: TFunction) {
  if (day.daysAgo === 0) return t("friendsOverview.today");
  if (day.daysAgo === 1) return t("friendsOverview.yesterday");
  return formatActivityDay(day.date);
}
