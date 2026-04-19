import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../components/ui/PrimaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/client";
import { tryParseSessionStatsDto } from "../lib/statsDto";
import type { SessionStatsDto } from "../types/session";

export default function WeeklyRecapScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const raw = await apiJson<unknown>("/sessions/stats?period=week", { token });
      const parsed = tryParseSessionStatsDto(raw);
      setStats(parsed);
      if (!parsed) setError(t("weeklyRecap.invalidStats"));
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : t("weeklyRecap.loadFailed"));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = stats?.summary;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("weeklyRecap.title")}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {s ? (
          <View style={styles.card}>
            <Text style={styles.line}>
              {t("weeklyRecap.sessionsHours", {
                sessions: s.total_sessions,
                hours: ((Number.isFinite(s.total_seconds) ? s.total_seconds : 0) / 3600).toFixed(1),
              })}
            </Text>
            <Text style={styles.line}>
              {t("weeklyRecap.streakBest", {
                current: s.current_streak_days,
                best: s.best_streak_days,
              })}
            </Text>
            {s.hours_delta_vs_prior_period != null ? (
              <Text style={styles.line}>
                {t("weeklyRecap.vsPrior", {
                  sign: s.hours_delta_vs_prior_period >= 0 ? "+" : "",
                  hours: s.hours_delta_vs_prior_period,
                })}
              </Text>
            ) : null}
            <Text style={styles.quote}>{t("weeklyRecap.quote")}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>{t("weeklyRecap.loading")}</Text>
        )}
        <PrimaryButton
          label={t("weeklyRecap.setGoals")}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            router.push("/(tabs)/stats");
          }}
        />
        <Pressable
          style={styles.back}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <Text style={styles.backTxt}>{t("weeklyRecap.close")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  line: { color: colors.textPrimary, ...typography.body },
  quote: {
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.md,
    ...typography.caption,
  },
  err: { color: colors.danger, ...typography.caption },
  muted: { color: colors.textSecondary, ...typography.body },
  back: { alignItems: "center", padding: spacing.md },
  backTxt: { color: colors.primary, fontFamily: fontFamily.bodyBold },
});
