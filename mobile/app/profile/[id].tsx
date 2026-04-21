import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityHeatmapCard } from "../../components/profile/ActivityHeatmapCard";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { StreakComparison } from "../../components/profile/StreakComparison";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { fetchBuddyStatus, fetchWeeklyRecap } from "../../lib/social";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import type { StreakOverviewDto } from "../../types/streak";
import type { BuddyStatusDto, SocialRecapDto } from "../../types/friends";

const ACHIEVEMENT_EMOJI: Record<string, string> = {
  first_session: "🎹",
  sessions_10: "🔥",
  sessions_50: "💪",
  streak_7: "⚡",
  marathon_2h: "👑",
  night_owl: "🦉",
};

type FriendStatus = "self" | "none" | "pending" | "accepted";

type ProfilePayload = {
  id: number;
  username: string;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  friends_count: number;
  is_premium?: boolean;
  identity_tags?: string[];
  created_at: string;
  reliability_score?: number;
  reliability_trend?: "up" | "down" | "stable";
  reliability_rank_percent?: number;
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
  const { token } = useAuth();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const userId = idStr ? parseInt(idStr, 10) : NaN;

  const [status, setStatus] = useState<FriendStatus | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [yourStreak, setYourStreak] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatusDto | null>(null);
  const [socialRecap, setSocialRecap] = useState<SocialRecapDto | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(userId) || userId <= 0) {
      setLoadState("error");
      setError(t("friendProfile.invalidProfile"));
      return;
    }
    setLoadState("loading");
    setError(null);
    try {
      const [st, ov, buddy, recap] = await Promise.all([
        apiJson<{ status: FriendStatus }>(`/friends/status/${userId}`, { token }),
        apiJson<StreakOverviewDto>("/streak/overview", { token }).catch(() => null),
        fetchBuddyStatus(token).catch(() => null),
        fetchWeeklyRecap(token).catch(() => null),
      ]);
      setStatus(st.status);
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
    }
  }, [token, userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadState === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errTitle}>{t("friendProfile.couldNotLoadTitle")}</Text>
          <Text style={styles.errSub}>{error}</Text>
          <PrimaryButton label={t("friendProfile.back")} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const locked = status === "none" || status === "pending";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
          hitSlop={12}
        >
          <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {locked ? (
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>{t("friendProfile.lockedTitle")}</Text>
            <Text style={styles.lockedSub}>
              {status === "pending"
                ? t("friendProfile.lockedPending")
                : t("friendProfile.lockedNone")}
            </Text>
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
              isPremium={Boolean(profile.is_premium)}
              identityTags={profile.identity_tags ?? []}
              streakStatusLabel={profile.streak_status_label}
              streakStatusEmoji={profile.streak_status_emoji}
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
                {t("friendProfile.reliabilityRank", {
                  rank: profile.reliability_rank_percent ?? 100,
                })}
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
              {stats.best_day ? (
                <Text style={styles.line}>
                  {t("friendProfile.bestDay", { date: stats.best_day })}
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
                  const emoji = ACHIEVEMENT_EMOJI[a.id] ?? "⭐";
                  const title = t(`friendProfile.achievements.${a.id}`, { defaultValue: a.id });
                  return (
                    <Text key={a.id} style={styles.ach}>
                      {emoji} {title}
                    </Text>
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
                  <View key={s.id} style={styles.sessRow}>
                    <Text style={styles.sessType}>{sessionTypeLabel(s.session_type, t)}</Text>
                    <Text style={styles.sessMeta}>{formatDurationWords(s.duration_seconds)}</Text>
                  </View>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  errTitle: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  errSub: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
  locked: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  lockedTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
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
  lineStrong: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  muted: { color: colors.textSecondary, ...typography.caption },
  ach: { color: colors.textPrimary, ...typography.body },
  sessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sessType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  sessMeta: { color: colors.textSecondary, ...typography.caption },
});
