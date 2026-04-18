import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto, SessionStatsDto } from "../../types/session";

export default function SessionCompleteScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const s = await apiJson<SessionDto>(`/sessions/item/${id}`, { token });
    setSession(s);
    try {
      const stats = await apiJson<SessionStatsDto>("/sessions/stats?period=all", { token });
      setStreak(stats.summary.current_streak_days);
    } catch {
      setStreak(null);
    }
  }, [id, token]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [router, secondsLeft]);

  const dur = session?.duration_seconds ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.title}>Session complete</Text>
        <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
        {streak !== null && streak > 0 ? (
          <Text style={styles.streak}>
            🔥 {streak} day streak!
          </Text>
        ) : null}
        <Text style={styles.auto}>Returning to dashboard in {secondsLeft}s…</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="View session details"
          onPress={() => router.replace({ pathname: "/session/[id]", params: { id: String(id) } })}
        />
        <PrimaryButton label="Start another session" onPress={() => router.replace("/session/setup")} />
        <Pressable style={styles.textBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
          <Text style={styles.textBtnLabel}>Back to dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  hero: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  check: {
    fontSize: 48,
    color: colors.success,
    fontFamily: fontFamily.heading,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  bigDur: { color: colors.primary, fontFamily: fontFamily.heading, fontSize: 36, marginTop: spacing.sm },
  streak: { color: colors.textSecondary, ...typography.subheadline, marginTop: spacing.sm },
  auto: { color: colors.textSecondary, ...typography.caption, marginTop: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  textBtn: { alignItems: "center", padding: spacing.md },
  textBtnLabel: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
