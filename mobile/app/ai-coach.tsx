import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import {
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/client";
import { tryParseStatsCoachChatDto, tryParseStatsCoachDto } from "../lib/outcomesDto";
import type { StatsCoachChatDto, StatsCoachDto } from "../types/outcomes";

type ChatMessage = { role: "user" | "assistant"; text: string };
type FocusArea = "consistency" | "arrangement" | "sound_design" | "mixing" | "finishing";
type PlanHorizon = "next_session" | "7_days" | "14_days";
type Intensity = "light" | "balanced" | "aggressive";

type CoachOption<T extends string> = {
  key: T;
  title: string;
  hint: string;
};

type CoachStructuredReply = {
  observation: string;
  why: string;
  actions: string[];
  raw: string;
};

function parseCoachReply(reply: string): CoachStructuredReply {
  const lines = reply
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let observation = "";
  let why = "";
  const actions: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("observation:")) {
      observation = line.slice("observation:".length).trim();
      continue;
    }
    if (lower.startsWith("why it matters:")) {
      why = line.slice("why it matters:".length).trim();
      continue;
    }
    if (line.startsWith("-")) {
      const action = line.slice(1).trim();
      if (action) actions.push(action);
    }
  }
  return {
    observation: observation || reply.trim(),
    why: why || "",
    actions: actions.slice(0, 3),
    raw: reply,
  };
}

function buildQuickCoachReply({
  focusArea,
  planHorizon,
  intensity,
  snapshot,
}: {
  focusArea: FocusArea;
  planHorizon: PlanHorizon;
  intensity: Intensity;
  snapshot: StatsCoachDto | null;
}): string {
  const sessions = snapshot?.sessions_completed ?? 0;
  const totalHours = Math.round((snapshot?.total_seconds ?? 0) / 3600);
  const win = snapshot?.wins?.[0] ?? "You already have useful production momentum.";
  const risk = snapshot?.risks?.[0] ?? "Inconsistent execution can slow down finished output.";
  const horizonText =
    planHorizon === "next_session" ? "your next session" : planHorizon === "14_days" ? "the next 14 days" : "the next 7 days";
  const intensityText =
    intensity === "light" ? "low-friction" : intensity === "aggressive" ? "high-output" : "balanced";
  const focusText = focusArea.replace("_", " ");

  return [
    `Observation: Based on ${sessions} completed sessions (~${totalHours}h), your strongest lever in ${horizonText} is ${focusText}. ${win}`,
    `Why it matters: ${risk} A ${intensityText} plan keeps momentum without random studio decisions.`,
    "Next actions:",
    `- Block 2 focused sessions for ${horizonText} and name one concrete deliverable per block.`,
    "- Keep one measurable target per session (minutes, bars, or mix pass).",
    "- End each session with a 2-line next-step note to reduce restart friction.",
  ].join("\n");
}

export default function AiCoachScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<StatsCoachDto | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("improve_week");
  const [selectedFocus, setSelectedFocus] = useState<FocusArea>("consistency");
  const [selectedHorizon, setSelectedHorizon] = useState<PlanHorizon>("7_days");
  const [selectedIntensity, setSelectedIntensity] = useState<Intensity>("balanced");
  const [refiningResponse, setRefiningResponse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    message: string;
    presetKey?: string;
    focusArea?: FocusArea;
    planHorizon?: PlanHorizon;
    intensity?: Intensity;
    label: string;
  } | null>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const quickPrompts = [
    { text: t("stats.aiCoachPrompt1"), presetKey: "improve_week" },
    { text: t("stats.aiCoachPrompt2"), presetKey: "consistency" },
    { text: t("stats.aiCoachPrompt3"), presetKey: "bottleneck" },
    { text: t("stats.aiCoachPrompt4"), presetKey: "plan_7d" },
  ];
  const focusOptions: CoachOption<FocusArea>[] = [
    { key: "consistency", title: t("stats.aiCoachFocusConsistency"), hint: t("stats.aiCoachFocusConsistencyHint") },
    { key: "arrangement", title: t("stats.aiCoachFocusArrangement"), hint: t("stats.aiCoachFocusArrangementHint") },
    { key: "sound_design", title: t("stats.aiCoachFocusSoundDesign"), hint: t("stats.aiCoachFocusSoundDesignHint") },
    { key: "mixing", title: t("stats.aiCoachFocusMixing"), hint: t("stats.aiCoachFocusMixingHint") },
    { key: "finishing", title: t("stats.aiCoachFocusFinishing"), hint: t("stats.aiCoachFocusFinishingHint") },
  ];
  const horizonOptions: CoachOption<PlanHorizon>[] = [
    { key: "next_session", title: t("stats.aiCoachHorizonNextSession"), hint: t("stats.aiCoachHorizonNextSessionHint") },
    { key: "7_days", title: t("stats.aiCoachHorizon7Days"), hint: t("stats.aiCoachHorizon7DaysHint") },
    { key: "14_days", title: t("stats.aiCoachHorizon14Days"), hint: t("stats.aiCoachHorizon14DaysHint") },
  ];
  const intensityOptions: CoachOption<Intensity>[] = [
    { key: "light", title: t("stats.aiCoachIntensityLight"), hint: t("stats.aiCoachIntensityLightHint") },
    { key: "balanced", title: t("stats.aiCoachIntensityBalanced"), hint: t("stats.aiCoachIntensityBalancedHint") },
    { key: "aggressive", title: t("stats.aiCoachIntensityAggressive"), hint: t("stats.aiCoachIntensityAggressiveHint") },
  ];
  const coachLocked = Boolean(snapshot && !snapshot.eligible);
  const signedOut = !token;

  const loadSnapshot = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const raw = await apiJson<unknown>("/outcomes/stats-coach/current", {
        token,
        timeoutMs: 30_000,
      });
      setSnapshot(tryParseStatsCoachDto(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("stats.loadFailed"));
    }
  }, [token, t]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 40);
    return () => clearTimeout(id);
  }, [messages, loading]);

  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => {
        chatScrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 0);
      return () => clearTimeout(id);
    }, []),
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancelPendingReply = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async ({
      msg,
      presetKey,
      focusArea,
      planHorizon,
      intensity,
      label,
    }: {
      msg: string;
      presetKey?: string;
      focusArea?: FocusArea;
      planHorizon?: PlanHorizon;
      intensity?: Intensity;
      label: string;
    }) => {
      if (!token || !msg.trim() || coachLocked || inFlightRef.current) return;
      inFlightRef.current = true;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      const clean = msg.trim();
      setRetryPayload(null);
      const userMessage: ChatMessage = { role: "user", text: label };
      const quickReply = buildQuickCoachReply({
        focusArea: focusArea ?? "consistency",
        planHorizon: planHorizon ?? "7_days",
        intensity: intensity ?? "balanced",
        snapshot,
      });
      setMessages((prev) => [...prev, userMessage, { role: "assistant", text: quickReply }]);
      setRefiningResponse(true);
      try {
        const raw = await apiJson<unknown>("/outcomes/stats-coach/chat", {
          token,
          method: "POST",
          body: {
            message: clean,
            preset_key: presetKey ?? null,
            focus_area: focusArea ?? null,
            plan_horizon: planHorizon ?? null,
            intensity: intensity ?? null,
            history: [],
          },
          timeoutMs: 30000,
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;
        const parsed: StatsCoachChatDto | null = tryParseStatsCoachChatDto(raw);
        if (!parsed) throw new Error(t("stats.invalidResponse"));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: parsed.reply || t("common.tryAgain") },
        ]);
        setRefiningResponse(false);
        if (!snapshot) {
          void loadSnapshot();
        }
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setRefiningResponse(false);
        if (e instanceof Error && e.name === "AbortError") {
          setError(t("stats.aiCoachCanceled"));
          return;
        }
        setRetryPayload({ message: clean, presetKey, focusArea, planHorizon, intensity, label });
        setError(e instanceof Error ? e.message : t("common.tryAgain"));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefiningResponse(false);
          abortRef.current = null;
          inFlightRef.current = false;
        }
      }
    },
    [token, t, snapshot, loadSnapshot, messages, coachLocked],
  );

  const selectedPromptObj = quickPrompts.find((item) => item.presetKey === selectedPrompt) ?? quickPrompts[0];
  const generatedMessage = [
    selectedPromptObj.text,
    `Focus area: ${selectedFocus.replace("_", " ")}`,
    `Plan horizon: ${selectedHorizon.replace("_", " ")}`,
    `Intensity: ${selectedIntensity}`,
  ].join(". ");
  const latestReply = [...messages].reverse().find((item) => item.role === "assistant")?.text ?? null;
  const latestPlan = latestReply ? parseCoachReply(latestReply) : null;
  const latestSelectionLabel = [...messages].reverse().find((item) => item.role === "user")?.text ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t("stats.aiCoachTitle")}</Text>
              <Text style={styles.subtitle}>{t("stats.aiCoachChatSubtitle")}</Text>
            </View>
            <SecondaryButton label={t("weeklyRecap.close")} onPress={() => router.back()} />
          </View>

          {coachLocked ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{t("stats.aiCoachLocked")}</Text>
              <Text style={styles.statusText}>
                {t("stats.aiCoachRequirements", { days: 14, sessions: 8 })}
              </Text>
            </View>
          ) : null}
          {signedOut ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{t("stats.aiCoachSignInRequiredTitle")}</Text>
              <Text style={styles.statusText}>{t("stats.aiCoachSignInRequiredHint")}</Text>
              <Pressable style={styles.signInCta} onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.signInCtaText}>{t("auth.login")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.chatCard}>
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatScroll}
              contentContainerStyle={[
                styles.chatWrap,
                messages.length === 0 && styles.chatWrapEmpty,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
              {latestPlan ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultTitle}>{t("stats.aiCoachPlanTitle")}</Text>
                  {latestSelectionLabel ? (
                    <Text style={styles.resultMeta}>{latestSelectionLabel}</Text>
                  ) : null}
                  <View style={styles.resultSection}>
                    <Text style={styles.resultLabel}>{t("stats.aiCoachResultObservation")}</Text>
                    <Text style={styles.resultValue}>{latestPlan.observation}</Text>
                  </View>
                  {latestPlan.why ? (
                    <View style={styles.resultSection}>
                      <Text style={styles.resultLabel}>{t("stats.aiCoachResultWhy")}</Text>
                      <Text style={styles.resultValue}>{latestPlan.why}</Text>
                    </View>
                  ) : null}
                  <View style={styles.resultSection}>
                    <Text style={styles.resultLabel}>{t("stats.aiCoachResultActions")}</Text>
                    {latestPlan.actions.length > 0 ? (
                      latestPlan.actions.map((action) => (
                        <Text key={action} style={styles.resultBullet}>
                          - {action}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.resultValue}>{latestPlan.raw}</Text>
                    )}
                  </View>
                  <View style={styles.resultActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.resultActionButton,
                        pressed && styles.errorRetryButtonPressed,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        void sendMessage({
                          msg: generatedMessage,
                          presetKey: selectedPromptObj.presetKey,
                          focusArea: selectedFocus,
                          planHorizon: selectedHorizon,
                          intensity: selectedIntensity,
                          label: `${selectedPromptObj.text} · ${selectedFocus} · ${selectedHorizon} · ${selectedIntensity}`,
                        });
                      }}
                      disabled={loading || coachLocked || signedOut}
                    >
                      <Text style={styles.resultActionText}>{t("stats.aiCoachRegenerate")}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.resultActionButton,
                        pressed && styles.errorRetryButtonPressed,
                      ]}
                      onPress={() => {
                        setMessages([]);
                        setError(null);
                        setRetryPayload(null);
                        setTimeout(() => {
                          chatScrollRef.current?.scrollTo({ y: 0, animated: true });
                        }, 40);
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.resultActionText}>{t("stats.aiCoachNewSetup")}</Text>
                    </Pressable>
                  </View>
                  {refiningResponse ? (
                    <View style={styles.refiningWrap}>
                      <Text style={styles.resultRefiningText}>{t("stats.aiCoachRefining")}</Text>
                      <View style={styles.skeletonLineShort} />
                      <View style={styles.skeletonLineFull} />
                      <View style={styles.skeletonLineMedium} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.chatEmptyState}>
                  <Text style={styles.chatEmptyTitle}>{t("stats.aiCoachTitle")}</Text>
                  <Text style={styles.chatEmptyText}>{t("stats.aiCoachGuidedSubtitle")}</Text>
                  <View style={styles.selectionSection}>
                    <Text style={styles.sectionLabel}>{t("stats.aiCoachQuestionLabel")}</Text>
                    <View style={styles.promptGrid}>
                      {quickPrompts.map((prompt) => (
                        <Pressable
                          key={prompt.presetKey}
                          style={({ pressed }) => [
                            styles.promptTile,
                            selectedPrompt === prompt.presetKey && styles.promptTileSelected,
                            pressed && styles.promptTilePressed,
                            (loading || coachLocked) && styles.promptTileDisabled,
                          ]}
                          onPress={() => setSelectedPrompt(prompt.presetKey)}
                          disabled={loading || coachLocked}
                        >
                          <Text style={styles.promptTileText}>{prompt.text}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.selectionSection}>
                    <Text style={styles.sectionLabel}>{t("stats.aiCoachFocusLabel")}</Text>
                    <View style={styles.pillWrap}>
                      {focusOptions.map((option) => (
                        <Pressable
                          key={option.key}
                          style={({ pressed }) => [
                            styles.pill,
                            selectedFocus === option.key && styles.pillSelected,
                            pressed && styles.promptTilePressed,
                          ]}
                          onPress={() => setSelectedFocus(option.key)}
                        >
                          <Text style={styles.pillTitle}>{option.title}</Text>
                          <Text style={styles.pillHint}>{option.hint}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.selectionSection}>
                    <Text style={styles.sectionLabel}>{t("stats.aiCoachHorizonLabel")}</Text>
                    <View style={styles.pillWrap}>
                      {horizonOptions.map((option) => (
                        <Pressable
                          key={option.key}
                          style={({ pressed }) => [
                            styles.pill,
                            selectedHorizon === option.key && styles.pillSelected,
                            pressed && styles.promptTilePressed,
                          ]}
                          onPress={() => setSelectedHorizon(option.key)}
                        >
                          <Text style={styles.pillTitle}>{option.title}</Text>
                          <Text style={styles.pillHint}>{option.hint}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.selectionSection}>
                    <Text style={styles.sectionLabel}>{t("stats.aiCoachIntensityLabel")}</Text>
                    <View style={styles.pillWrap}>
                      {intensityOptions.map((option) => (
                        <Pressable
                          key={option.key}
                          style={({ pressed }) => [
                            styles.pill,
                            selectedIntensity === option.key && styles.pillSelected,
                            pressed && styles.promptTilePressed,
                          ]}
                          onPress={() => setSelectedIntensity(option.key)}
                        >
                          <Text style={styles.pillTitle}>{option.title}</Text>
                          <Text style={styles.pillHint}>{option.hint}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )}
              {loading ? (
                <View style={styles.aiBubble}>
                  <Text style={styles.bubbleRole}>{t("stats.aiCoachTitle")}</Text>
                  <Text style={styles.thinkingText}>{t("stats.aiCoachSending")}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.errorRetryButtonPressed,
                    ]}
                    onPress={cancelPendingReply}
                  >
                    <Text style={styles.cancelButtonText}>{t("stats.aiCoachCancel")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.inlineError}>{error}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.errorRetryButton,
                  pressed && styles.errorRetryButtonPressed,
                ]}
                onPress={() => {
                  if (retryPayload) {
                    void sendMessage({
                      msg: retryPayload.message,
                      presetKey: retryPayload.presetKey,
                      focusArea: retryPayload.focusArea,
                      planHorizon: retryPayload.planHorizon,
                      intensity: retryPayload.intensity,
                      label: retryPayload.label,
                    });
                    return;
                  }
                  void loadSnapshot();
                }}
              >
                <Text style={styles.errorRetryText}>
                  {retryPayload ? t("stats.aiCoachRetryLast") : t("common.tryAgain")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.inputCard}>
            <PrimaryButton
              label={loading ? t("stats.aiCoachSending") : t("stats.aiCoachGeneratePlan")}
              onPress={() => {
                Keyboard.dismiss();
                void sendMessage({
                  msg: generatedMessage,
                  presetKey: selectedPromptObj.presetKey,
                  focusArea: selectedFocus,
                  planHorizon: selectedHorizon,
                  intensity: selectedIntensity,
                  label: `${selectedPromptObj.text} · ${selectedFocus} · ${selectedHorizon} · ${selectedIntensity}`,
                });
              }}
              disabled={loading || coachLocked || signedOut}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  headerRow: {
    gap: spacing.sm,
  },
  headerTextWrap: {
    gap: 2,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.sectionTitle },
  subtitle: { color: colors.textSecondary, ...typography.body, fontFamily: fontFamily.bodyMedium },
  statusCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 4,
  },
  statusTitle: { color: colors.textPrimary, ...typography.meta, fontFamily: fontFamily.bodyBold },
  statusText: { color: colors.textSecondary, ...typography.caption, fontFamily: fontFamily.body },
  chatCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
  },
  chatScroll: { flex: 1 },
  chatWrapEmpty: { flexGrow: 1, justifyContent: "center" },
  chatEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  chatEmptyTitle: {
    color: colors.textPrimary,
    ...typography.sectionTitle,
    fontFamily: fontFamily.heading,
  },
  chatEmptyText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
    textAlign: "center",
    maxWidth: 320,
  },
  chatWrap: { gap: spacing.sm },
  aiBubble: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: spacing.sm,
  },
  bubbleRole: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
    marginBottom: 4,
  },
  bubbleText: { color: colors.textPrimary, ...typography.body, fontFamily: fontFamily.bodyMedium },
  resultCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  resultTitle: {
    color: colors.textPrimary,
    ...typography.sectionTitle,
    fontFamily: fontFamily.heading,
  },
  resultMeta: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  resultSection: {
    gap: 4,
  },
  resultLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  resultValue: {
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  resultBullet: {
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  resultActionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  resultActionButton: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  resultActionText: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  resultRefiningText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  refiningWrap: {
    gap: spacing.xs,
    marginTop: 2,
  },
  skeletonLineFull: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.14)",
    width: "100%",
  },
  skeletonLineMedium: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.1)",
    width: "72%",
  },
  skeletonLineShort: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "44%",
  },
  thinkingText: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  inlineError: {
    color: colors.danger,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  errorCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    backgroundColor: "rgba(239,68,68,0.08)",
    padding: spacing.sm,
    gap: spacing.xs,
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  errorRetryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  errorRetryText: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  cancelButton: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  signInCta: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  signInCtaText: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  promptGrid: {
    marginTop: spacing.xs,
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  promptTile: {
    width: "46%",
    minHeight: 86,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  promptTileSelected: {
    borderColor: "rgba(255,61,0,0.7)",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  promptTilePressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  promptTileDisabled: {
    opacity: 0.5,
  },
  promptTileText: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "center",
  },
  selectionSection: {
    width: "100%",
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  pillWrap: {
    width: "100%",
    gap: spacing.xs,
  },
  pill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  pillSelected: {
    borderColor: "rgba(255,61,0,0.7)",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  pillTitle: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  pillHint: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
});
