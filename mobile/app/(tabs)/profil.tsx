import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BadgeIcon } from "../../components/ui/BadgeIcon";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { StatCard } from "../../components/ui/StatCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, apiJson } from "../../lib/client";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import type { SessionStatsDto } from "../../types/session";
import type { StreakMilestonesDto } from "../../types/streak";

function formatHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toString();
}

export default function ProfilScreen() {
  const { user, signOut, token } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestonesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pingTemplate, setPingTemplate] = useState<"test" | "session_demo" | "streak_demo">("test");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [rawS, m] = await Promise.all([
        apiJson<unknown>("/sessions/stats?period=all", { token }),
        apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
      ]);
      setStats(tryParseSessionStatsDto(rawS));
      setMilestones(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile data.");
      setStats(null);
      setMilestones(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  async function logout() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    await signOut();
    router.replace("/(auth)/login");
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  const pingPush = useCallback(async () => {
    if (!token) return;
    setPushBusy(true);
    try {
      const body =
        pingTemplate === "test"
          ? { template: "test" as const, title: "Prodify", body: "Test-Push vom Server" }
          : pingTemplate === "session_demo"
            ? { template: "session_demo" as const }
            : { template: "streak_demo" as const, streak_days: 12 };
      const r = await apiJson<{ attempted: number; delivered_ok: number; message?: string | null }>(
        "/notifications/ping-self",
        {
          token,
          method: "POST",
          body,
        },
      );
      Alert.alert(
        "Push",
        `Zugestellt: ${r.delivered_ok} / ${r.attempted}${r.message ? `\n${r.message}` : ""}`,
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      Alert.alert("Push", msg);
    } finally {
      setPushBusy(false);
    }
  }, [pingTemplate, token]);

  const summary = stats?.summary;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.slice(0, 2).toUpperCase() ?? "BT"}
            </Text>
          </View>
          <Text style={styles.username}>{user?.username ?? "Prodify User"}</Text>
          <Text style={styles.email}>{user?.email ?? "loading..."}</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingHint}>Loading your stats…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && summary ? (
          <View style={styles.statsGrid}>
            <StatCard label="Total Sessions" value={summary.total_sessions} />
            <StatCard label="Current streak" value={`🔥 ${summary.current_streak_days}`} />
            <StatCard label="Best streak" value={`${summary.best_streak_days} days`} />
            <StatCard label="Total hours" value={formatHours(summary.total_seconds)} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Milestones</Text>
        {milestones ? (
          <Text style={styles.milestoneSub}>
            Longest streak recorded: {milestones.longest_streak_days} days
          </Text>
        ) : null}

        {!loading && milestones ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesRow}
          >
            {milestones.milestones.map((item) => (
              <BadgeIcon key={item.days} label={item.title} unlocked={item.unlocked} />
            ))}
          </ScrollView>
        ) : null}

        {!loading && !milestones && !error ? (
          <Text style={styles.muted}>Milestones unavailable.</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Server-Push (Expo + FCM)</Text>
        <Text style={styles.pushHint}>
          Backend: EXPO_ACCESS_TOKEN für Expo-Tokens; optional Firebase Service Account (JSON oder
          Pfad) für Android-FCM-Tokens. Templates simulieren echte In-App-Texte.
        </Text>
        <View style={styles.pingChips}>
          {(
            [
              { id: "test" as const, label: "Test" },
              { id: "session_demo" as const, label: "Session" },
              { id: "streak_demo" as const, label: "Streak" },
            ] as const
          ).map((p) => (
            <Pressable
              key={p.id}
              style={[styles.pingChip, pingTemplate === p.id && styles.pingChipOn]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                setPingTemplate(p.id);
              }}
            >
              <Text style={[styles.pingChipTxt, pingTemplate === p.id && styles.pingChipTxtOn]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton
          label={pushBusy ? "Sende…" : "Push senden"}
          onPress={pingPush}
          loading={pushBusy}
        />

        <View style={styles.settingsWrap}>
          <PrimaryButton label="Settings" onPress={() => {}} />
        </View>

        <View style={styles.signoutWrap}>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={logout}
          >
            <Text style={styles.outlineBtnText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  profileHero: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#2b2140",
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  username: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  email: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  loadingBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingHint: { color: colors.textSecondary, ...typography.caption },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,80,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    marginBottom: spacing.md,
  },
  errorText: { color: "#ff9a9a", ...typography.caption, marginBottom: spacing.sm },
  retry: { alignSelf: "flex-start", paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  milestoneSub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  pushHint: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  pingChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  pingChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pingChipOn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.12)" },
  pingChipTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  pingChipTxtOn: { color: colors.textPrimary },
  muted: { color: colors.textSecondary, ...typography.caption, marginBottom: spacing.sm },
  badgesRow: {
    gap: spacing.sm,
  },
  settingsWrap: {
    marginTop: spacing.lg,
  },
  signoutWrap: {
    marginTop: spacing.md,
  },
  outlineBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  outlineBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
