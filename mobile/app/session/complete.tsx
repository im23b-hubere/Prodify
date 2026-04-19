import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

const AUTO_RETURN_SECONDS = 10;

export default function SessionCompleteScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS);
  const [autoReturnEnabled, setAutoReturnEnabled] = useState(true);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    if (!token || !id) {
      setLoadState("error");
      setLoadError(!token ? t("sessionComplete.notSignedIn") : t("sessionComplete.missingSession"));
      return;
    }
    if (!Number.isFinite(Number(id))) {
      setLoadState("error");
      setLoadError(t("sessionComplete.invalidSession"));
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const rawSession = await apiJson<unknown>(`/sessions/item/${id}`, { token });
      if (cancelled.current) return;
      const s = tryParseSessionDto(rawSession);
      if (!s) {
        setLoadState("error");
        setLoadError(t("sessionComplete.invalidData"));
        setSession(null);
        return;
      }
      if (s.stopped_at == null) {
        setLoadState("error");
        setLoadError(t("sessionComplete.stillInProgress"));
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
      setAutoReturnEnabled(true);
    } catch (e) {
      if (cancelled.current) return;
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : t("sessionComplete.loadError"));
      setSession(null);
    }
  }, [id, token, t]);

  useEffect(() => {
    cancelled.current = false;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void load();
    return () => {
      cancelled.current = true;
    };
  }, [load]);

  useEffect(() => {
    if (loadState !== "ready" || !autoReturnEnabled) return;
    if (secondsLeft <= 0) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((x) => x - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoReturnEnabled, loadState, router, secondsLeft]);

  const dur = session?.duration_seconds ?? 0;
  const autoReturnProgress = useMemo(() => {
    const elapsed = AUTO_RETURN_SECONDS - secondsLeft;
    const pct = elapsed / AUTO_RETURN_SECONDS;
    return Math.max(0, Math.min(1, pct));
  }, [secondsLeft]);

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
          <Text style={styles.title}>{t("sessionComplete.title")}</Text>
          <Text style={styles.muted}>{t("sessionComplete.loadingSession")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.title}>{t("sessionComplete.errorTitle")}</Text>
          <Text style={styles.muted}>{loadError ?? t("sessionComplete.unknownError")}</Text>
          <View style={styles.actions}>
            <PrimaryButton label={t("sessionComplete.tryAgain")} onPress={() => void load()} />
            <Pressable style={styles.textBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
              <Text style={styles.textBtnLabel}>{t("sessionComplete.backToDashboard")}</Text>
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
        <Text style={styles.title}>{t("sessionComplete.title")}</Text>
        <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
        {streak !== null && streak > 0 ? (
          <Text style={styles.streak}>{t("sessionComplete.streakLine", { count: streak })}</Text>
        ) : null}
        {completionMessage ? <Text style={styles.motivation}>{completionMessage}</Text> : null}
        {autoReturnEnabled ? (
          <View style={styles.autoWrap}>
            <Text style={styles.auto}>
              {t("sessionComplete.autoReturn", { seconds: secondsLeft })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(autoReturnProgress * 100)}%` }]}
              />
            </View>
            <Pressable
              style={styles.stayBtn}
              onPress={() => {
                setAutoReturnEnabled(false);
                Haptics.selectionAsync().catch(() => undefined);
              }}
            >
              <Text style={styles.stayBtnLabel}>{t("sessionComplete.stayHere")}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.auto}>{t("sessionComplete.autoReturnCancelled")}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={t("sessionComplete.viewDetails")}
          onPress={() => router.replace(`/session/${id}` as never)}
        />
        <PrimaryButton
          label={t("sessionComplete.startAnother")}
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
          <Text style={styles.textBtnLabel}>{t("sessionComplete.backToDashboard")}</Text>
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
  autoWrap: {
    marginTop: spacing.md,
    width: "100%",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  stayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  stayBtnLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  textBtn: { alignItems: "center", padding: spacing.md },
  textBtnLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
