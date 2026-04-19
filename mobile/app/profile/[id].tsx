import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
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
import { formatDurationWords } from "../../lib/sessionTime";
import type { StreakOverviewDto } from "../../types/streak";

const ACHIEVEMENT_META: Record<string, { title: string; emoji: string }> = {
  first_session: { title: "First session", emoji: "🎹" },
  sessions_10: { title: "10 sessions", emoji: "🔥" },
  sessions_50: { title: "50 sessions", emoji: "💪" },
  streak_7: { title: "Week streak", emoji: "⚡" },
  marathon_2h: { title: "Marathon producer", emoji: "👑" },
  night_owl: { title: "Night owl", emoji: "🦉" },
};

type FriendStatus = "self" | "none" | "pending" | "accepted";

type ProfilePayload = {
  id: number;
  username: string;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  friends_count: number;
  created_at: string;
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

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(userId) || userId <= 0) {
      setLoadState("error");
      setError("Invalid profile.");
      return;
    }
    setLoadState("loading");
    setError(null);
    try {
      const [st, ov] = await Promise.all([
        apiJson<{ status: FriendStatus }>(`/friends/status/${userId}`, { token }),
        apiJson<StreakOverviewDto>("/streak/overview", { token }).catch(() => null),
      ]);
      setStatus(st.status);
      setYourStreak(ov?.current_streak ?? 0);

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
      setError(e instanceof Error ? e.message : "Could not load profile.");
    }
  }, [token, userId]);

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
          <Text style={styles.errTitle}>{"Couldn't load profile"}</Text>
          <Text style={styles.errSub}>{error}</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
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
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {locked ? (
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>Friend profile</Text>
            <Text style={styles.lockedSub}>
              {status === "pending"
                ? "When they accept your request, you'll see full stats here."
                : "Add this producer as a friend to see their streak, heatmap, and sessions."}
            </Text>
            <PrimaryButton label="Friends" onPress={() => router.push("/(tabs)/friends")} />
          </View>
        ) : profile && stats ? (
          <>
            <ProfileHeader
              username={profile.username}
              totalSessions={profile.total_sessions}
              currentStreak={profile.current_streak}
              friendsCount={profile.friends_count}
              status={status === "self" ? "self" : "accepted"}
            />

            {status !== "self" ? (
              <View style={styles.block}>
                <StreakComparison yourStreak={yourStreak} theirStreak={stats.current_streak} />
              </View>
            ) : null}

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Overview</Text>
              <Text style={styles.line}>Total time: {stats.total_hours}h</Text>
              <Text style={styles.line}>Sessions: {stats.total_sessions}</Text>
              {stats.best_day ? <Text style={styles.line}>Best day: {stats.best_day}</Text> : null}
            </View>

            <View style={styles.block}>
              <ActivityHeatmapCard days={stats.heatmap_days} />
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Achievements</Text>
              {stats.achievements.length === 0 ? (
                <Text style={styles.muted}>None unlocked yet.</Text>
              ) : (
                stats.achievements.map((a) => {
                  const meta = ACHIEVEMENT_META[a.id] ?? { title: a.id, emoji: "⭐" };
                  return (
                    <Text key={a.id} style={styles.ach}>
                      {meta.emoji} {meta.title}
                    </Text>
                  );
                })
              )}
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Recent sessions</Text>
              {sessions.length === 0 ? (
                <Text style={styles.muted}>No completed sessions yet.</Text>
              ) : (
                sessions.map((s) => (
                  <View key={s.id} style={styles.sessRow}>
                    <Text style={styles.sessType}>{s.session_type}</Text>
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
