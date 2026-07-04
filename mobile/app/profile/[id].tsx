import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AchievementGlyph, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ActivityHeatmapCard } from "../../components/profile/ActivityHeatmapCard";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { StreakComparison } from "../../components/profile/StreakComparison";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { API_BASE_URL } from "../../constants/api";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { fetchBuddyStatus, fetchWeeklyRecap } from "../../lib/social";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords, formatSessionListDate } from "../../lib/sessionTime";
import type { StreakOverviewDto } from "../../types/streak";
import type { BuddyStatusDto, SocialRecapDto } from "../../types/friends";

type FriendStatus = "self" | "none" | "pending" | "accepted";

type FriendStatusPayload = {
  status: FriendStatus;
  username?: string | null;
  pending_direction?: "outgoing" | "incoming" | null;
};

type ProfilePayload = {
  id: number;
  username: string;
  profile_picture_url?: string | null;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  friends_count: number;
  is_premium?: boolean;
  identity_tags?: string[];
  created_at: string;
  reliability_score?: number;
  reliability_trend?: "up" | "down" | "stable";
  reliability_rank_percent?: number | null;
  streak_status_key?: string;
  streak_status_label?: string;
  streak_status_emoji?: string;
};

type StatsPayload = {
  total_hours: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  type_breakdown: Record<string, number>;
  best_day: string | null;
  heatmap_days: { date: string; seconds: number; intensity: number }[];
  achievements: { id: string; unlocked_at: string }[];
};

type SessionItem = {
  id: number;
  session_type: string;
  duration_seconds: number;
  started_at: string;
  mood_level: number | null;
};

export default function FriendProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const userId = idStr ? parseInt(idStr, 10) : NaN;

  const [status, setStatus] = useState<FriendStatus | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [pendingDirection, setPendingDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [yourStreak, setYourStreak] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatusDto | null>(null);
  const [socialRecap, setSocialRecap] = useState<SocialRecapDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!token || !Number.isFinite(userId) || userId <= 0) {
        setLoadState("error");
        setError(t("friendProfile.invalidProfile"));
        setRefreshing(false);
        return;
      }
      if (!silent) {
        setLoadState("loading");
      }
      setError(null);
      try {
        const [st, ov, buddy, recap] = await Promise.all([
          apiJson<FriendStatusPayload>(`/friends/status/${userId}`, { token }),
          apiJson<StreakOverviewDto>("/streak/overview", { token }).catch(() => null),
          fetchBuddyStatus(token).catch(() => null),
          fetchWeeklyRecap(token).catch(() => null),
        ]);
        setStatus(st.status);
        setTargetUsername(st.username ?? null);
        setPendingDirection(st.pending_direction ?? null);
        setYourStreak(ov?.current_streak ?? 0);
        setBuddyStatus(buddy);
        setSocialRecap(recap);

        if (st.status !== "self" && st.status !== "accepted") {
          setProfile(null);
          setStats(null);
          setSessions([]);
          setLoadState("ready");
          return;
        }

        const [p, s, sess] = await Promise.all([
          apiJson<ProfilePayload>(`/users/${userId}/profile`, { token }),
          apiJson<StatsPayload>(`/users/${userId}/stats`, { token }),
          apiJson<SessionItem[]>(`/users/${userId}/sessions?limit=10`, { token }),
        ]);
        setProfile(p);
        setStats(s);
        setSessions(Array.isArray(sess) ? sess : []);
        setLoadState("ready");
      } catch (e) {
        setLoadState("error");
        setError(e instanceof Error ? e.message : t("friendProfile.loadError"));
      } finally {
        setRefreshing(false);
      }
    },
    [token, userId, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const bestDayLabel = useMemo(() => {
    const day = stats?.best_day;
    if (!day?.trim()) return null;
    const key = `friendProfile.weekdays.${day.trim().toLowerCase()}`;
    const translated = t(key, { defaultValue: "" });
    if (translated && translated !== key) return translated;
    return day;
  }, [stats?.best_day, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  const isOwnProfile = user?.id != null && user.id === userId;

  const goBack = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.back();
  }, [router]);

  const loadingMessage = isOwnProfile
    ? t("friendProfile.loadingOwnProfile")
    : t("friendProfile.loadingProfile");

  if (loadState === "loading" && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            onPress={goBack}
            hitSlop={12}
          >
            <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
          </Pressable>
        </View>
        <View style={styles.bootWrap}>
          <LoadingState message={loadingMessage} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            onPress={goBack}
            hitSlop={12}
          >
            <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
          </Pressable>
        </View>
        <View style={styles.bootWrap}>
          <ErrorState
            title={t("friendProfile.couldNotLoadTitle")}
            message={error ?? t("friendProfile.loadError")}
            retryLabel={t("friendProfile.retry")}
            onRetry={() => void load()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendProfile.backA11y")}
            style={styles.bootBackBtn}
            onPress={goBack}
          >
            <Text style={styles.bootBackTxt}>{t("friendProfile.back")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const locked = status === "none" || status === "pending";
  const profilePictureUrl = profile?.profile_picture_url?.trim()
    ? profile.profile_picture_url.startsWith("http")
      ? profile.profile_picture_url
      : `${API_BASE_URL}${profile.profile_picture_url}`
    : null;

  const lockedSub =
    status === "pending"
      ? pendingDirection === "incoming"
        ? t("friendProfile.lockedPendingIncoming")
        : t("friendProfile.lockedPendingOutgoing")
      : t("friendProfile.lockedNone");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendProfile.backA11y")}
          onPress={goBack}
          hitSlop={12}
        >
          <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {locked ? (
          <View style={styles.locked}>
            <Text style={styles.lockedMainTitle}>
              {targetUsername
                ? t("friendProfile.lockedUserHeading", { name: targetUsername })
                : t("friendProfile.lockedTitle")}
            </Text>
            <Text style={styles.lockedSub}>{lockedSub}</Text>
            <PrimaryButton
              label={t("friendProfile.friendsTab")}
              onPress={() => router.push("/(tabs)/friends")}
            />
          </View>
        ) : profile && stats ? (
          <>
            <ProfileHeader
              username={profile.username}
              totalSessions={profile.total_sessions}
              currentStreak={profile.current_streak}
              friendsCount={profile.friends_count}
              status={status === "self" ? "self" : "accepted"}
              identityTags={profile.identity_tags ?? []}
              streakStatusLabel={profile.streak_status_label}
              streakStatusEmoji={profile.streak_status_emoji}
              profilePictureUrl={profilePictureUrl}
            />

            {status !== "self" ? (
              <View style={styles.block}>
                <StreakComparison yourStreak={yourStreak} theirStreak={stats.current_streak} />
              </View>
            ) : null}

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.reliabilityTitle")}</Text>
              <Text style={styles.lineStrong}>
                {(profile.reliability_score ?? 0).toFixed(1)}
                /10
              </Text>
              <Text style={styles.line}>
                {typeof profile.reliability_rank_percent === "number"
                  ? t("friendProfile.reliabilityRank", {
                      rank: profile.reliability_rank_percent,
                    })
                  : t("friendProfile.reliabilityRankUnavailable")}
              </Text>
              <Text style={styles.line}>
                {profile.reliability_trend === "up"
                  ? t("friendProfile.reliabilityTrendUp")
                  : profile.reliability_trend === "down"
                    ? t("friendProfile.reliabilityTrendDown")
                    : t("friendProfile.reliabilityTrendStable")}
              </Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.overview")}</Text>
              <Text style={styles.line}>
                {t("friendProfile.totalTime", { hours: stats.total_hours })}
              </Text>
              <Text style={styles.line}>
                {t("friendProfile.sessionsLine", { count: stats.total_sessions })}
              </Text>
              {stats.best_day && bestDayLabel ? (
                <Text style={styles.line}>
                  {t("friendProfile.bestDay", { date: bestDayLabel })}
                </Text>
              ) : null}
              <Text style={styles.line}>
                {buddyStatus?.buddy_user_id === profile.id
                  ? t("friendProfile.activeBuddy")
                  : t("friendProfile.socialFriend")}
              </Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.sharedMomentumTitle")}</Text>
              <Text style={styles.line}>
                {t("friendProfile.creativeRunLine", {
                  yours: yourStreak,
                  theirs: stats.current_streak,
                })}
              </Text>
              {status === "self" ? (
                <>
                  <Text style={styles.line}>
                    {socialRecap
                      ? t("friendProfile.teamSessionsLine", {
                          sessions: socialRecap.team_sessions,
                          sign: socialRecap.wow_delta_sessions >= 0 ? "+" : "",
                          wow: socialRecap.wow_delta_sessions,
                        })
                      : t("friendProfile.comparisonHint")}
                  </Text>
                  {socialRecap?.identity_tag ? (
                    <Text style={styles.lineStrong}>
                      {t(`friendsScreen.identityTag.${socialRecap.identity_tag}`)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.lineMuted}>
                    {t("friendProfile.sharedMomentumFriendHint")}
                  </Text>
                  <Text style={styles.line}>{t("friendProfile.comparisonHint")}</Text>
                </>
              )}
            </View>

            <View style={styles.block}>
              <ActivityHeatmapCard days={stats.heatmap_days} />
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.achievementsTitle")}</Text>
              {stats.achievements.length === 0 ? (
                <Text style={styles.muted}>{t("friendProfile.noneUnlocked")}</Text>
              ) : (
                stats.achievements.map((a) => {
                  const title = t(`friendProfile.achievements.${a.id}`, { defaultValue: a.id });
                  return (
                    <View key={a.id} style={[glyphRowStyle, styles.achRow]}>
                      <AchievementGlyph achievementId={a.id} size={18} />
                      <Text style={styles.ach}>{title}</Text>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>{t("friendProfile.recentSessions")}</Text>
              {sessions.length === 0 ? (
                <Text style={styles.muted}>{t("friendProfile.noSessionsYet")}</Text>
              ) : (
                sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityLabel={t("friendProfile.openSessionA11y", {
                      type: sessionTypeLabel(s.session_type, t),
                    })}
                    style={({ pressed }) => [styles.sessRow, pressed && styles.sessRowPressed]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      router.push({
                        pathname: "/session/[id]",
                        params: { id: String(s.id), ownerName: profile.username },
                      } as Href);
                    }}
                  >
                    <View style={styles.sessCol}>
                      <Text style={styles.sessType}>{sessionTypeLabel(s.session_type, t)}</Text>
                      <Text style={styles.sessDate}>{formatSessionListDate(s.started_at)}</Text>
                    </View>
                    <Text style={styles.sessMeta}>{formatDurationWords(s.duration_seconds)}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  back: { color: colors.secondary, fontFamily: fontFamily.bodyBold, ...typography.body },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  bootWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bootBackBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bootBackTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  locked: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  lockedMainTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    textAlign: "center",
  },
  lockedSub: { color: colors.textSecondary, ...typography.body },
  block: { marginBottom: spacing.sm },
  statsCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  line: { color: colors.textPrimary, ...typography.body },
  lineMuted: { color: colors.textSecondary, ...typography.body },
  lineStrong: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  muted: { color: colors.textSecondary, ...typography.caption },
  ach: { color: colors.textPrimary, ...typography.body, flex: 1 },
  achRow: { marginBottom: spacing.xs },
  sessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sessRowPressed: { opacity: 0.85 },
  sessCol: { flex: 1, gap: 2, paddingRight: spacing.sm },
  sessType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  sessDate: { color: colors.textSecondary, ...typography.caption },
  sessMeta: { color: colors.textSecondary, ...typography.caption },
});
