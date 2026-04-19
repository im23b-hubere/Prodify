import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { PENDING_SESSION_SETUP_KEY } from "../../constants/sessionUi";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { tryParseSessionDto } from "../../lib/sessionDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import { generateMotivationMessage, getTimeOfDay } from "../../lib/motivationEngine";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

const AUTO_RETURN_SECONDS = 5;

export default function SessionCompleteScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    if (!token || !id) {
      setLoadState("error");
      setLoadError(!token ? "Not signed in." : "Missing session.");
      return;
    }
    if (!Number.isFinite(Number(id))) {
      setLoadState("error");
      setLoadError("Invalid session.");
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const raw = await apiJson<unknown>(`/sessions/item/${id}`, { token });
      if (cancelled.current) return;
      const s = tryParseSessionDto(raw);
      if (!s) {
        setLoadState("error");
        setLoadError("Invalid session data from server.");
        setSession(null);
        return;
      }
      if (s.stopped_at == null) {
        setLoadState("error");
        setLoadError("This session is still in progress.");
        setSession(null);
        return;
      }
      setSession(s);
      try {
        const statsRaw = await apiJson<unknown>("/sessions/stats?period=all", { token });
        const stats = tryParseSessionStatsDto(statsRaw);
        if (!cancelled.current) setStreak(stats?.summary.current_streak_days ?? null);
      } catch {
        if (!cancelled.current) setStreak(null);
      }
      setLoadState("ready");
      setSecondsLeft(AUTO_RETURN_SECONDS);
    } catch (e) {
      if (cancelled.current) return;
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : "Could not load session.");
      setSession(null);
    }
  }, [id, token]);

  useEffect(() => {
    cancelled.current = false;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void load();
    return () => {
      cancelled.current = true;
    };
  }, [load]);

  useEffect(() => {
    if (loadState !== "ready") return;
    if (secondsLeft <= 0) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [loadState, router, secondsLeft]);

  const dur = session?.duration_seconds ?? 0;

  const completionMessage = useMemo(() => {
    if (!session) return null;
    return generateMotivationMessage({
      session: {
        duration_seconds: session.duration_seconds ?? 0,
        focus_score: session.focus_score ?? null,
        session_type: String(session.session_type),
      },
      streak: streak ?? 0,
      todayCount: 0,
      weekCount: 0,
      friends: { activeNow: 0, topThisWeek: null },
      timeOfDay: getTimeOfDay(),
    });
  }, [session, streak]);

  if (loadState === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.title}>Session complete</Text>
          <Text style={styles.muted}>Loading your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.muted}>{loadError ?? "Unknown error"}</Text>
          <View style={styles.actions}>
            <PrimaryButton label="Try again" onPress={() => void load()} />
            <Pressable style={styles.textBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
              <Text style={styles.textBtnLabel}>Back to dashboard</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.title}>Session complete</Text>
        <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
        {streak !== null && streak > 0 ? (
          <Text style={styles.streak}>🔥 {streak} day streak!</Text>
        ) : null}
        {completionMessage ? <Text style={styles.motivation}>{completionMessage}</Text> : null}
        <Text style={styles.auto}>Returning to dashboard in {secondsLeft}s…</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="View session details"
          onPress={() => router.replace(`/session/${id}`)}
        />
        <PrimaryButton
          label="Start another session"
          onPress={async () => {
            try {
              await SecureStore.setItemAsync(PENDING_SESSION_SETUP_KEY, "1");
            } catch {
              /* still navigate */
            }
            router.replace("/(tabs)/dashboard");
          }}
        />
        <Pressable style={styles.textBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
          <Text style={styles.textBtnLabel}>Back to dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  hero: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  check: {
    fontSize: 48,
    color: colors.success,
    fontFamily: fontFamily.heading,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    textAlign: "center",
  },
  muted: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
  bigDur: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 36,
    marginTop: spacing.sm,
  },
  streak: { color: colors.textSecondary, ...typography.subheadline, marginTop: spacing.sm },
  motivation: {
    color: colors.textPrimary,
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  auto: { color: colors.textSecondary, ...typography.caption, marginTop: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  textBtn: { alignItems: "center", padding: spacing.md },
  textBtnLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
