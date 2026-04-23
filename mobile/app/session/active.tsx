import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { parseSessionList, sessionTagsList, tryParseSessionDto } from "../../lib/sessionDto";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import { SESSION_TYPE_IDS, type SessionDto, type SessionType } from "../../types/session";

function formatClock(totalSeconds: number) {
  const s = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : 0;
  const min = Math.floor(s / 60);
  const sec = s % 60;
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
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; source?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const rawSource = params.source;
  const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
  const [session, setSession] = useState<SessionDto | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [longestCompletedSeconds, setLongestCompletedSeconds] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const longSessionWarned = useRef(false);
  const stopSessionInFlight = useRef(false);

  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const load = useCallback(async () => {
    if (!token) return;
    let sessionId: number | null = null;
    if (id != null && id !== "") {
      const parsedId = Number(id);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        setError(t("sessionActive.invalidSession"));
        return;
      }
      sessionId = parsedId;
    } else {
      try {
        const activeRaw = await apiJson<unknown>("/sessions/active", { token });
        if (
          activeRaw &&
          typeof activeRaw === "object" &&
          !Array.isArray(activeRaw) &&
          typeof (activeRaw as { id?: unknown }).id === "number" &&
          Number.isFinite((activeRaw as { id: number }).id) &&
          (activeRaw as { id: number }).id > 0
        ) {
          sessionId = (activeRaw as { id: number }).id;
        }
      } catch {
        sessionId = null;
      }
      if (sessionId == null) {
        setError(t("sessionActive.invalidSession"));
        setSession(null);
        return;
      }
    }
    try {
      const raw = await apiJson<unknown>(`/sessions/item/${sessionId}`, { token });
      const data = tryParseSessionDto(raw);
      if (!data) {
        setError(t("sessionActive.invalidData"));
        setSession(null);
        return;
      }
      if (data.stopped_at != null) {
        router.replace(`/session/${data.id}`);
        return;
      }
      setSession(data);
      setDraftNotes(data.notes ?? "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionActive.loadFailed"));
      setSession(null);
    }
  }, [id, token, router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    apiJson<unknown>("/sessions/list?limit=200", { token })
      .then((raw) => {
        const list = parseSessionList(raw);
        const max = list
          .filter((s) => s.stopped_at && (s.duration_seconds ?? 0) > 0)
          .reduce((acc, s) => Math.max(acc, s.duration_seconds ?? 0), 0);
        setLongestCompletedSeconds(max > 0 ? max : null);
      })
      .catch(() => setLongestCompletedSeconds(null));
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = session ? effectiveElapsedSeconds(session, nowMs) : 0;

  useEffect(() => {
    if (elapsed < 8 * 3600 || longSessionWarned.current) return;
    longSessionWarned.current = true;
    Alert.alert(t("sessionActive.longSessionTitle"), t("sessionActive.longSessionBody"));
  }, [elapsed, t]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
    );
  }, [pulse]);

  const fromDashboard = source === "dashboard";

  const minimizeToDashboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.back();
  }, [router]);

  const swipeDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(fromDashboard)
        .activeOffsetY(12)
        .failOffsetX([-28, 28])
        .onEnd((e) => {
          if (e.translationY > 48 || e.velocityY > 650) {
            runOnJS(minimizeToDashboard)();
          }
        }),
    [fromDashboard, minimizeToDashboard],
  );

  const pause = useCallback(async () => {
    if (!token || !session) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const raw = await apiJson<unknown>(`/sessions/item/${session.id}/pause`, {
        token,
        method: "POST",
      });
      const s = tryParseSessionDto(raw);
      if (s) setSession(s);
      else setError(t("sessionDetail.invalidResponse"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionActive.pauseFailed"));
    } finally {
      setBusy(false);
    }
  }, [session, token, t]);

  const resume = useCallback(async () => {
    if (!token || !session) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const raw = await apiJson<unknown>(`/sessions/item/${session.id}/resume`, {
        token,
        method: "POST",
      });
      const s = tryParseSessionDto(raw);
      if (s) setSession(s);
      else setError(t("sessionDetail.invalidResponse"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionActive.resumeFailed"));
    } finally {
      setBusy(false);
    }
  }, [session, token, t]);

  const saveNotes = useCallback(async () => {
    if (!token || !session) return;
    const trimmed = draftNotes.trim().slice(0, 200);
    if (trimmed === (session.notes ?? "").trim()) return;
    setSavingNotes(true);
    try {
      const raw = await apiJson<unknown>(`/sessions/item/${session.id}`, {
        token,
        method: "PATCH",
        body: { notes: trimmed.length ? trimmed : null },
      });
      const updated = tryParseSessionDto(raw);
      if (updated) setSession(updated);
      else setError(t("sessionDetail.invalidResponse"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionActive.saveNotesFailed"));
    } finally {
      setSavingNotes(false);
    }
  }, [draftNotes, session, token, t]);

  const setSessionType = useCallback(
    async (next: SessionType) => {
      if (!token || !session || session.session_type === next) return;
      setBusy(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        const raw = await apiJson<unknown>(`/sessions/item/${session.id}`, {
          token,
          method: "PATCH",
          body: { session_type: next },
        });
        const updated = tryParseSessionDto(raw);
        if (updated) setSession(updated);
        else setError(t("sessionDetail.invalidResponse"));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sessionActive.updateFailed"));
      } finally {
        setBusy(false);
      }
    },
    [session, token, t],
  );

  const confirmStop = useCallback(() => {
    if (!session || stopSessionInFlight.current) return;
    const sid = session.id;
    Alert.alert(
      t("dashboard.endSessionTitle"),
      t("dashboard.endSessionWorked", { duration: formatDurationWords(elapsed) }),
      [
        { text: t("dashboard.keepGoing"), style: "cancel" },
        {
          text: t("dashboard.endSessionConfirm"),
          style: "destructive",
          onPress: async () => {
            if (!token || stopSessionInFlight.current) return;
            stopSessionInFlight.current = true;
            setBusy(true);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => undefined,
              );
              await apiJson<SessionDto>("/sessions/stop", {
                token,
                method: "POST",
                body: { session_id: sid },
              });
              router.replace({ pathname: "/session/complete", params: { id: String(sid) } });
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
                () => undefined,
              );
              setError(e instanceof Error ? e.message : t("sessionActive.stopFailed"));
              void load();
            } finally {
              stopSessionInFlight.current = false;
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [elapsed, load, router, session, token, t]);

  const insightLine = useMemo(() => {
    if (longestCompletedSeconds == null) {
      return t("sessionActive.insightDefault");
    }
    if (elapsed > longestCompletedSeconds) {
      return t("sessionActive.insightPastBest", {
        prev: formatDurationWords(longestCompletedSeconds),
      });
    }
    return t("sessionActive.insightLongest", {
      duration: formatDurationWords(longestCompletedSeconds),
    });
  }, [elapsed, longestCompletedSeconds, t]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>{error ?? t("sessionActive.loadingSession")}</Text>
      </SafeAreaView>
    );
  }

  const isPaused = !!session.pause_started_at;
  const tagList = sessionTagsList(session.tags);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        {fromDashboard ? (
          <GestureDetector gesture={swipeDownGesture}>
            <View style={styles.minimizeStrip}>
              <View style={styles.grabber} />
              <Text style={styles.minimizeHint}>{t("sessionActive.minimizeHint")}</Text>
            </View>
          </GestureDetector>
        ) : null}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{sessionTypeLabel(session.session_type, t)}</Text>
          </View>
          <Text style={styles.warn}>{t("sessionActive.inProgress")}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.timerWrap, pulseStyle]}>
            <Text style={styles.timer}>{formatClock(elapsed)}</Text>
            <Text style={styles.subTimer}>{formatDurationWords(elapsed)}</Text>
          </Animated.View>

          <View style={styles.insightCard}>
            <Text style={styles.insightText}>{insightLine}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.editLabel}>{t("sessionActive.sessionType")}</Text>
            <View style={styles.typeRow}>
              {SESSION_TYPE_IDS.map((stype) => {
                const active = session.session_type === stype;
                return (
                  <Pressable
                    key={stype}
                    onPress={() => setSessionType(stype)}
                    disabled={busy}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                  >
                    <Text style={[styles.typeChipTxt, active && styles.typeChipTxtActive]}>
                      {sessionTypeLabel(stype, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {session.mood_level ? (
              <Text style={styles.row}>
                {t("sessionActive.mood", { emoji: MOOD_EMOJI[session.mood_level] ?? "—" })}
              </Text>
            ) : null}

            <Text style={styles.editLabel}>{t("sessionActive.notes")}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t("sessionActive.notesPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={200}
              value={draftNotes}
              onChangeText={setDraftNotes}
              onBlur={() => saveNotes().catch(() => undefined)}
            />
            <View style={styles.notesFooter}>
              <Text style={styles.counter}>{draftNotes.length}/200</Text>
              <Pressable
                onPress={() => saveNotes().catch(() => undefined)}
                disabled={savingNotes}
                hitSlop={8}
              >
                <Text style={styles.saveNotes}>
                  {savingNotes ? t("sessionActive.saving") : t("sessionActive.save")}
                </Text>
              </Pressable>
            </View>

            {tagList.length > 0 ? (
              <View style={styles.tags}>
                {tagList.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagTxt}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <View style={styles.actions}>
            {isPaused ? (
              <PrimaryButton label={t("sessionActive.resume")} onPress={resume} loading={busy} />
            ) : (
              <Pressable style={styles.pauseOutline} onPress={pause} disabled={busy}>
                <Text style={styles.pauseText}>{t("sessionActive.pause")}</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.stopBtn} onPress={confirmStop} disabled={busy}>
            <Text style={styles.stopTxt}>{t("sessionActive.stopSession")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  muted: { color: colors.textSecondary, textAlign: "center", marginTop: 40 },
  minimizeStrip: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  minimizeHint: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 12,
  },
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
  insightCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(162,89,255,0.08)",
    padding: spacing.md,
  },
  insightText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    textAlign: "center",
  },
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
  editLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.15)",
  },
  typeChipTxt: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  typeChipTxtActive: { color: colors.textPrimary },
  notesInput: {
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  notesFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  counter: { color: colors.textSecondary, ...typography.caption },
  saveNotes: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
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
