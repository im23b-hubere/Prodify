import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "../ui/GlassCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../types/friends";

type Props = {
  currentUserId: number;
  activity: FriendActivityDto[];
  leaderboard: FriendLeaderboardEntryDto[];
  loading: boolean;
  primaryAction?: { message: string; ctaLabel: string; onPress: () => void; busy?: boolean } | null;
  secondaryHint?: string | null;
};

function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

function formatAgo(iso: string, t: TFunction): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("friendsWidget.agoNow");
  if (mins < 60) return t("friendsWidget.agoMinutes", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t("friendsWidget.agoHours", { hours });
  const days = Math.floor(hours / 24);
  return t("friendsWidget.agoDays", { days });
}

export const FriendsActivityWidget = memo(function FriendsActivityWidget({
  currentUserId,
  activity,
  leaderboard,
  loading,
  primaryAction = null,
  secondaryHint = null,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const ago = useCallback((iso: string) => formatAgo(iso, t), [t]);

  const topOthers = leaderboard.filter((e) => e.user_id !== currentUserId).slice(0, 3);
  const feed = activity.slice(0, 5);

  if (!loading && topOthers.length === 0 && feed.length === 0) {
    return (
      <GlassCard>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("friendsWidget.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("friendsWidget.emptySub")}</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              router.push("/(tabs)/friends");
            }}
          >
            <Text style={styles.emptyBtnTxt}>{t("friendsWidget.findFriends")}</Text>
          </Pressable>
        </View>
      </GlassCard>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("friendsWidget.title")}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.push("/(tabs)/friends");
          }}
        >
          <Text style={styles.viewAll}>{t("friendsWidget.viewAll")}</Text>
        </Pressable>
      </View>

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
                Haptics.selectionAsync().catch(() => undefined);
                router.push(`/profile/${a.user_id}` as Href);
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
      ) : loading ? (
        <Text style={styles.loading}>{t("friendsWidget.loading")}</Text>
      ) : null}

      {primaryAction ? (
        <View style={styles.primaryWrap}>
          <Text style={styles.primaryMsg}>{primaryAction.message}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={primaryAction.onPress}
            disabled={primaryAction.busy}
          >
            <Text style={styles.primaryBtnTxt}>
              {primaryAction.busy ? "..." : primaryAction.ctaLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {secondaryHint ? (
        <View style={styles.signalsWrap}>
          <Text style={styles.signalTxt}>{secondaryHint}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.lg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  viewAll: { color: colors.secondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  subtle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  leaderBlock: { gap: spacing.xs },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTxt: { color: "#111", fontFamily: fontFamily.bodyBold, ...typography.caption },
  name: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  meta: { color: colors.textSecondary, ...typography.caption },
  feed: { gap: 4, marginTop: spacing.sm },
  feedRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  feedName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  feedMeta: { color: colors.textSecondary, ...typography.caption },
  loading: { color: colors.textSecondary, ...typography.caption },
  signalsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  signalPill: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  signalTxt: { color: colors.textPrimary, ...typography.caption, fontFamily: fontFamily.bodyBold },
  primaryWrap: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
    padding: spacing.sm,
    gap: spacing.xs,
  },
  primaryMsg: { color: colors.textPrimary, ...typography.caption, fontFamily: fontFamily.bodyBold },
  primaryBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.24)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  primaryBtnTxt: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  empty: { gap: spacing.sm },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  emptySub: { color: colors.textSecondary, ...typography.body },
  emptyBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyBtnTxt: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
});
