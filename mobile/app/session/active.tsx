import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

function formatClock(totalSeconds: number) {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const MOOD_EMOJI: Record<number, string> = {
  1: "😴",
  2: "😐",
  3: "🙂",
  4: "😊",
  5: "🔥",
};

export default function SessionActiveScreen() {
  useKeepAwake();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const longSessionWarned = useRef(false);

  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const load = useCallback(async () => {
    if (!token || !id) return;
    const data = await apiJson<SessionDto>(`/sessions/item/${id}`, { token });
    setSession(data);
  }, [id, token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = session ? effectiveElapsedSeconds(session, nowMs) : 0;

  useEffect(() => {
    if (elapsed < 8 * 3600 || longSessionWarned.current) return;
    longSessionWarned.current = true;
    Alert.alert("Long session", "You've been going for over 8 hours. Still working?");
  }, [elapsed]);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.04, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
  }, [pulse]);

  const pause = useCallback(async () => {
    if (!token || !session) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const s = await apiJson<SessionDto>(`/sessions/item/${session.id}/pause`, { token, method: "POST" });
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pause failed");
    } finally {
      setBusy(false);
    }
  }, [session, token]);

  const resume = useCallback(async () => {
    if (!token || !session) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const s = await apiJson<SessionDto>(`/sessions/item/${session.id}/resume`, { token, method: "POST" });
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }, [session, token]);

  const confirmStop = useCallback(() => {
    if (!session) return;
    const mins = Math.round(elapsed / 60);
    Alert.alert("End session?", `You worked for ${formatDurationWords(elapsed)}.`, [
      { text: "Keep going", style: "cancel" },
      {
        text: "End session",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          setBusy(true);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            await apiJson<SessionDto>("/sessions/stop", {
              token,
              method: "POST",
              body: { session_id: session.id },
            });
            router.replace({ pathname: "/session/complete", params: { id: String(session.id) } });
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
            setError(e instanceof Error ? e.message : "Stop failed");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [elapsed, router, session, token]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>{error ?? "Loading session…"}</Text>
      </SafeAreaView>
    );
  }

  const isPaused = !!session.pause_started_at;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{session.session_type}</Text>
        </View>
        <Text style={styles.warn}>Session in progress</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.timerWrap, pulseStyle]}>
          <Text style={styles.timer}>{formatClock(elapsed)}</Text>
          <Text style={styles.subTimer}>{formatDurationWords(elapsed)}</Text>
        </Animated.View>

        <View style={styles.card}>
          {session.mood_level ? (
            <Text style={styles.row}>
              Mood: {MOOD_EMOJI[session.mood_level] ?? "—"}
            </Text>
          ) : null}
          {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}
          {session.tags && session.tags.length > 0 ? (
            <View style={styles.tags}>
              {session.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagTxt}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <View style={styles.actions}>
          {isPaused ? (
            <PrimaryButton label="Resume" onPress={resume} loading={busy} />
          ) : (
            <Pressable style={styles.pauseOutline} onPress={pause} disabled={busy}>
              <Text style={styles.pauseText}>Pause</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.stopBtn} onPress={confirmStop} disabled={busy}>
          <Text style={styles.stopTxt}>Stop session</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  muted: { color: colors.textSecondary, textAlign: "center", marginTop: 40 },
  header: { paddingHorizontal: spacing.md, gap: spacing.xs },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,61,0,0.2)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  warn: { color: colors.textSecondary, ...typography.caption },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  timerWrap: { alignItems: "center", marginVertical: spacing.lg },
  timer: {
    fontSize: 64,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  subTimer: { marginTop: spacing.xs, color: colors.textSecondary, ...typography.body },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { color: colors.textPrimary, fontFamily: fontFamily.body, ...typography.body },
  notes: { color: colors.textSecondary, ...typography.caption },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  tagTxt: { color: colors.textPrimary, ...typography.caption },
  err: { color: colors.danger, ...typography.caption },
  actions: { marginTop: spacing.sm },
  pauseOutline: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  pauseText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  stopBtn: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,59,48,0.2)",
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  stopTxt: { color: colors.danger, fontFamily: fontFamily.bodyBold, ...typography.body },
});
