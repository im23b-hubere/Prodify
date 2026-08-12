import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { EmptyState } from "../states/EmptyState";
import { GlassCard } from "../ui/GlassCard";
import { LoadingState } from "../states/LoadingState";
import { colors } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatTimeAgo } from "../../lib/timeAgo";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../types/friends";
import { styles } from "./FriendsActivityWidget.styles";

type Props = {
  currentUserId: number;
  activity: FriendActivityDto[];
  leaderboard: FriendLeaderboardEntryDto[];
  loading: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  primaryAction?: {
    message: string;
    ctaLabel: string;
    hint?: string;
    onPress: () => void;
    busy?: boolean;
  } | null;
  secondaryHint?: string | null;
};

function parseActivityTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

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
  const ago = useCallback(
    (iso: string | null | undefined) =>
      parseActivityTimestamp(iso) > 0
        ? formatTimeAgo(iso as string, t, "friendsWidget.agoNow")
        : t("friendsWidget.agoNow"),
    [t],
  );

  const topOthers = leaderboard.filter((e) => e.user_id !== currentUserId).slice(0, 3);
  const feed = activity.slice(0, 5);
  const hasContent = topOthers.length > 0 || feed.length > 0;
  const toggleExpanded = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setExpanded((v) => !v);
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <LoadingState message={t("friendsWidget.loading")} />
      </GlassCard>
    );
  }

  if (!hasContent) {
    if (collapsible && !expanded) {
      return (
        <View style={styles.wrap} testID="friends-widget-collapsed">
          <Pressable
            accessibilityRole="button"
            onPress={toggleExpanded}
            style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.title}>{t("friendsWidget.title")}</Text>
            <View style={styles.headerActions}>
              <Text style={styles.expandLabel}>{t("friendsWidget.expand")}</Text>
              <ChevronDown color={colors.secondary} size={18} />
            </View>
          </Pressable>
        </View>
      );
    }
    return (
      <GlassCard>
        <EmptyState
          compact
          title={t("friendsWidget.emptyTitle")}
          message={t("friendsWidget.emptySub")}
          actionLabel={t("friendsWidget.findFriends")}
          onAction={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.push("/(tabs)/friends");
          }}
        />
      </GlassCard>
    );
  }

  const collapsedHeader = collapsible && !expanded;

  return (
    <View
      style={styles.wrap}
      testID={collapsedHeader ? "friends-widget-collapsed" : "friends-widget-expanded"}
    >
      <Pressable
        accessibilityRole="button"
        onPress={collapsible ? toggleExpanded : undefined}
        disabled={!collapsible}
        style={({ pressed }) => [styles.headerRow, collapsible && pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.title}>{t("friendsWidget.title")}</Text>
        <View style={styles.headerActions}>
          {primaryAction && collapsedHeader ? <View style={styles.nudgeDot} /> : null}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              router.push("/(tabs)/friends");
            }}
          >
            <Text style={styles.viewAll}>{t("friendsWidget.viewAll")}</Text>
          </Pressable>
          {collapsible ? (
            expanded ? (
              <ChevronUp color={colors.secondary} size={18} />
            ) : (
              <ChevronDown color={colors.secondary} size={18} />
            )
          ) : null}
        </View>
      </Pressable>

      {collapsedHeader ? null : (
        <>
          {topOthers.length > 0 ? (
            <View style={styles.leaderBlock}>
              <Text style={styles.subtle}>{t("friendsWidget.thisWeek")}</Text>
              {topOthers.map((e) => (
                <Pressable
                  key={e.user_id}
                  style={({ pressed }) => [styles.leaderRow, pressed && { opacity: 0.88 }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    router.push(`/profile/${e.user_id}` as Href);
                  }}
                >
                  <View style={[styles.rankBadge, { backgroundColor: rankColor(e.rank) }]}>
                    <Text style={styles.rankTxt}>#{e.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{e.username}</Text>
                    <Text style={styles.meta}>
                      {t("friendsWidget.sessionsMeta", {
                        sessions: e.sessions_in_period,
                        streak: e.current_streak_days,
                      })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {feed.length > 0 ? (
            <View style={styles.feed}>
              <Text style={styles.subtle}>{t("friendsWidget.recent")}</Text>
              {feed.map((a) => (
                <Pressable
                  key={`${a.session_id}-${a.completed_at}`}
                  style={({ pressed }) => [styles.feedRow, pressed && { opacity: 0.88 }]}
                  onPress={() => {
                    if (!Number.isFinite(a.session_id) || a.session_id <= 0) return;
                    Haptics.selectionAsync().catch(() => undefined);
                    router.push({
                      pathname: "/session/[id]",
                      params: { id: String(a.session_id), ownerName: a.username },
                    } as Href);
                  }}
                >
                  <Text style={styles.feedName} numberOfLines={1}>
                    {a.username}
                  </Text>
                  <Text style={styles.feedMeta} numberOfLines={1}>
                    {sessionTypeLabel(a.session_type, t)} · {ago(a.completed_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {primaryAction ? (
            <View style={styles.primaryWrap}>
              <Text style={styles.primaryMsg}>{primaryAction.message}</Text>
              {primaryAction.hint ? (
                <Text style={styles.primaryHint}>{primaryAction.hint}</Text>
              ) : null}
              <Pressable
                style={styles.primaryBtn}
                onPress={primaryAction.onPress}
                disabled={primaryAction.busy}
                accessibilityRole="button"
                accessibilityState={{ busy: Boolean(primaryAction.busy) }}
              >
                {primaryAction.busy ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textPrimary}
                    accessibilityLabel={t("common.loading")}
                  />
                ) : (
                  <Text style={styles.primaryBtnTxt}>{primaryAction.ctaLabel}</Text>
                )}
              </Pressable>
            </View>
          ) : null}
          {secondaryHint ? (
            <View style={styles.signalsWrap}>
              <Text style={styles.signalTxt}>{secondaryHint}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
});
