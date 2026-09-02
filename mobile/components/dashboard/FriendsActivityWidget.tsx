import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatTimeAgo } from "../../lib/timeAgo";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../types/friends";
import { styles } from "./FriendsActivityWidget.styles";

type PrimaryAction = {
  message: string;
  ctaLabel: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
};

type Props = {
  currentUserId: number;
  activity: FriendActivityDto[];
  leaderboard: FriendLeaderboardEntryDto[];
  loading: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  primaryAction?: PrimaryAction | null;
  secondaryHint?: string | null;
};

export const FriendsActivityWidget = memo(function FriendsActivityWidget({
  currentUserId,
  activity,
  leaderboard,
  loading,
  collapsible = false,
  defaultExpanded = false,
  primaryAction = null,
  secondaryHint = null,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded || Boolean(primaryAction));
  const toggleExpanded = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setExpanded((current) => !current);
  }, []);
  const leaders = leaderboard.filter((entry) => entry.user_id !== currentUserId).slice(0, 3);
  const feed = activity.slice(0, 3);
  if (loading) return <LoadingWidget t={t} />;
  if (leaders.length === 0 && feed.length === 0) {
    return (
      <EmptyWidget
        t={t}
        collapsed={collapsible && !expanded}
        onExpand={toggleExpanded}
        onFindFriends={() => navigate(router, "/(tabs)/friends")}
      />
    );
  }
  const collapsed = collapsible && !expanded;
  return (
    <View style={styles.wrap} testID={`friends-widget-${collapsed ? "collapsed" : "expanded"}`}>
      <WidgetHeader
        t={t}
        collapsible={collapsible}
        collapsed={collapsed}
        hasPrimaryAction={Boolean(primaryAction)}
        onToggle={toggleExpanded}
        onViewAll={collapsed ? undefined : () => navigate(router, "/(tabs)/friends")}
      />
      {!collapsed ? (
        <WidgetContent
          t={t}
          leaders={leaders}
          feed={feed}
          primaryAction={primaryAction}
          secondaryHint={secondaryHint}
        />
      ) : null}
    </View>
  );
});

function LoadingWidget({ t }: { t: TFunction }) {
  return (
    <View style={styles.wrap} testID="friends-widget-loading">
      <Text style={styles.title}>{t("friendsWidget.title")}</Text>
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <Text style={styles.loading}>{t("friendsWidget.loading")}</Text>
      </View>
    </View>
  );
}

function EmptyWidget({
  t,
  collapsed,
  onExpand,
  onFindFriends,
}: {
  t: TFunction;
  collapsed: boolean;
  onExpand: () => void;
  onFindFriends: () => void;
}) {
  if (collapsed) {
    return (
      <View style={styles.wrap} testID="friends-widget-collapsed">
        <WidgetHeader t={t} collapsible collapsed hasPrimaryAction={false} onToggle={onExpand} />
      </View>
    );
  }
  return (
    <View style={styles.wrap} testID="friends-widget-empty">
      <Text style={styles.emptyTitle}>{t("friendsWidget.emptyTitle")}</Text>
      <Text style={styles.emptySub}>{t("friendsWidget.emptySub")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onFindFriends}
        style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.emptyBtnTxt}>{t("friendsWidget.findFriends")}</Text>
      </Pressable>
    </View>
  );
}

function WidgetHeader({
  t,
  collapsible,
  collapsed,
  hasPrimaryAction,
  onToggle,
  onViewAll,
}: {
  t: TFunction;
  collapsible: boolean;
  collapsed: boolean;
  hasPrimaryAction: boolean;
  onToggle: () => void;
  onViewAll?: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        onPress={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        style={({ pressed }) => [styles.headerTitleHit, collapsible && pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.title}>{t("friendsWidget.title")}</Text>
        {hasPrimaryAction && collapsed ? <View style={styles.nudgeDot} /> : null}
        {collapsible ? (
          collapsed ? (
            <ChevronDown color={colors.textSecondary} size={18} />
          ) : (
            <ChevronUp color={colors.textSecondary} size={18} />
          )
        ) : null}
      </Pressable>
      {onViewAll ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewAll}
          style={({ pressed }) => pressed && { opacity: 0.85 }}
        >
          <Text style={styles.viewAll}>{t("friendsWidget.viewAll")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function WidgetContent({
  t,
  leaders,
  feed,
  primaryAction,
  secondaryHint,
}: {
  t: TFunction;
  leaders: FriendLeaderboardEntryDto[];
  feed: FriendActivityDto[];
  primaryAction: PrimaryAction | null;
  secondaryHint: string | null;
}) {
  return (
    <>
      {leaders.length > 0 ? <LeaderboardBlock t={t} leaders={leaders} /> : <ActivityFeed t={t} feed={feed} />}
      <NudgeAction t={t} action={primaryAction} />
      {!primaryAction && secondaryHint ? (
        <Text style={styles.signalTxt}>{secondaryHint}</Text>
      ) : null}
    </>
  );
}

function LeaderboardBlock({ t, leaders }: { t: TFunction; leaders: FriendLeaderboardEntryDto[] }) {
  const router = useRouter();
  return (
    <View style={styles.leaderBlock}>
      {leaders.map((entry) => (
        <Pressable
          key={entry.user_id}
          style={({ pressed }) => [styles.leaderRow, pressed && { opacity: 0.88 }]}
          onPress={() => navigate(router, `/profile/${entry.user_id}` as Href)}
        >
          <Text style={styles.rankTxt}>{entry.rank}</Text>
          <View style={styles.leaderCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {entry.username}
            </Text>
            <Text style={styles.meta}>
              {t("friendsWidget.sessionsMeta", {
                sessions: entry.sessions_in_period,
                streak: entry.current_streak_days,
              })}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ActivityFeed({ t, feed }: { t: TFunction; feed: FriendActivityDto[] }) {
  const router = useRouter();
  if (feed.length === 0) return null;
  return (
    <View style={styles.feed}>
      {feed.map((activity) => (
        <Pressable
          key={`${activity.session_id}-${activity.completed_at}`}
          style={({ pressed }) => [styles.feedRow, pressed && { opacity: 0.88 }]}
          onPress={() => openActivity(router, activity)}
        >
          <Text style={styles.feedName} numberOfLines={1}>
            {activity.username}
          </Text>
          <Text style={styles.feedMeta} numberOfLines={1}>
            {sessionTypeLabel(activity.session_type, t)} · {timeAgo(activity.completed_at, t)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function NudgeAction({ t, action }: { t: TFunction; action: PrimaryAction | null }) {
  if (!action) return null;
  return (
    <View style={styles.primaryWrap}>
      <Text style={styles.primaryMsg}>{action.message}</Text>
      {action.hint ? <Text style={styles.primaryHint}>{action.hint}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        onPress={action.onPress}
        disabled={action.busy}
        accessibilityRole="button"
        accessibilityState={{ busy: Boolean(action.busy) }}
      >
        {action.busy ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel={t("common.loading")}
          />
        ) : (
          <Text style={styles.primaryBtnTxt}>{action.ctaLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

function navigate(router: ReturnType<typeof useRouter>, href: Href) {
  Haptics.selectionAsync().catch(() => undefined);
  router.push(href);
}

function openActivity(router: ReturnType<typeof useRouter>, activity: FriendActivityDto) {
  if (!Number.isFinite(activity.session_id) || activity.session_id <= 0) return;
  navigate(router, {
    pathname: "/session/[id]",
    params: { id: String(activity.session_id), ownerName: activity.username },
  } as Href);
}

function timeAgo(value: string | null | undefined, t: TFunction) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return t("friendsWidget.agoNow");
  return formatTimeAgo(value, t, "friendsWidget.agoNow");
}
