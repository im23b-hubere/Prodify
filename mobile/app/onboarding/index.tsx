import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  BookOpen,
  Calendar,
  Clock,
  Disc3,
  Flame,
  Headphones,
  Mic2,
  Music2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { OnboardingPlanSummary } from "../../components/onboarding/OnboardingPlanSummary";
import { OnboardingQuizShell } from "../../components/onboarding/OnboardingQuizShell";
import { QuizOptionCard } from "../../components/onboarding/QuizOptionCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import {
  ONBOARDING_COMPLETE_KEY,
  PENDING_WEEKLY_GOAL_KEY,
  WEEKLY_GOAL_CONFIGURED_KEY,
} from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { savePendingWeeklyGoal } from "../../lib/onboardingGoalSync";
import {
  experienceLabel,
  genreLabel,
  producerGoalLabel,
  saveOnboardingQuiz,
  type OnboardingQuizAnswers,
  type ProducerExperience,
  type ProducerGenre,
  type ProducerGoal,
} from "../../lib/onboardingQuiz";

const GOALS = [3, 5, 7, 10, 14] as const;
const QUIZ_STEPS = 5;

type Step =
  | "welcome"
  | "experience"
  | "genre"
  | "producerGoal"
  | "weeklyGoal"
  | "plan"
  | "notifications";

const EXPERIENCE_OPTIONS: {
  id: ProducerExperience;
  icon: typeof Clock;
  hintKey: string;
}[] = [
  { id: "under_1y", icon: Sparkles, hintKey: "onboarding.quiz.experience.hints.under_1y" },
  { id: "1_3y", icon: TrendingUp, hintKey: "onboarding.quiz.experience.hints.1_3y" },
  { id: "3_5y", icon: Music2, hintKey: "onboarding.quiz.experience.hints.3_5y" },
  { id: "5y_plus", icon: Trophy, hintKey: "onboarding.quiz.experience.hints.5y_plus" },
];

const GENRE_OPTIONS: { id: ProducerGenre; icon: typeof Mic2 }[] = [
  { id: "hip_hop", icon: Mic2 },
  { id: "edm", icon: Disc3 },
  { id: "pop", icon: Headphones },
  { id: "other", icon: Music2 },
];

const PRODUCER_GOAL_OPTIONS: { id: ProducerGoal; icon: typeof Target }[] = [
  { id: "more_output", icon: TrendingUp },
  { id: "consistency", icon: Flame },
  { id: "finish_tracks", icon: Target },
  { id: "learn_skills", icon: BookOpen },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [answers, setAnswers] = useState<OnboardingQuizAnswers>({ weeklyGoal: 7 });
  const [busy, setBusy] = useState(false);

  const goal = answers.weeklyGoal ?? 7;

  const dailyTarget = useMemo(() => Math.max(1, Math.round((goal / 7) * 10) / 10), [goal]);
  const dailyTargetDisplay = useMemo(
    () => (Number.isInteger(dailyTarget) ? String(dailyTarget) : dailyTarget.toFixed(1)),
    [dailyTarget],
  );
  const dailyTargetUnit = useMemo(
    () =>
      dailyTarget === 1
        ? t("onboarding.quiz.weeklyGoal.session")
        : t("onboarding.quiz.weeklyGoal.sessions"),
    [dailyTarget, t],
  );

  const goToWeeklyGoal = useCallback(() => setStep("weeklyGoal"), []);

  const advanceQuiz = useCallback((next: Step) => {
    setTimeout(() => setStep(next), 200);
  }, []);

  const pickExperience = useCallback(
    (id: ProducerExperience) => {
      setAnswers((prev) => ({ ...prev, experience: id }));
      advanceQuiz("genre");
    },
    [advanceQuiz],
  );

  const pickGenre = useCallback(
    (id: ProducerGenre) => {
      setAnswers((prev) => ({ ...prev, genre: id }));
      advanceQuiz("producerGoal");
    },
    [advanceQuiz],
  );

  const pickProducerGoal = useCallback(
    (id: ProducerGoal) => {
      setAnswers((prev) => ({ ...prev, producerGoal: id }));
      advanceQuiz("weeklyGoal");
    },
    [advanceQuiz],
  );

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      const snapshot: OnboardingQuizAnswers = { ...answers, weeklyGoal: goal };
      await saveOnboardingQuiz(snapshot).catch(() => undefined);
      try {
        await savePendingWeeklyGoal(goal);
      } catch {
        /* continue */
      }
      if (token) {
        try {
          await apiJson("/goals/set", {
            token,
            method: "POST",
            body: { goal_type: "weekly_sessions", target_value: goal },
          });
          await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
          await AsyncStorage.removeItem(PENDING_WEEKLY_GOAL_KEY).catch(() => undefined);
        } catch {
          /* goal sync is best-effort */
        }
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1").catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({
        pathname: "/paywall",
        params: { source: "onboarding", variant: "outcome" },
      });
    } finally {
      setBusy(false);
    }
  }, [answers, goal, router, token]);

  const requestNotif = useCallback(async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
      await finish();
    } finally {
      setBusy(false);
    }
  }, [finish]);

  const planRows = useMemo(() => {
    const rows = [];
    if (answers.genre) {
      rows.push({
        key: "genre",
        icon: Music2,
        label: t("onboarding.quiz.plan.rowGenre"),
        value: genreLabel(answers.genre, t),
      });
    }
    if (answers.producerGoal) {
      rows.push({
        key: "goal",
        icon: Target,
        label: t("onboarding.quiz.plan.rowFocus"),
        value: producerGoalLabel(answers.producerGoal, t),
      });
    }
    rows.push({
      key: "weekly",
      icon: Calendar,
      label: t("onboarding.quiz.plan.rowWeekly"),
      value: t("onboarding.quiz.plan.weeklyValue", { count: goal }),
    });
    return rows;
  }, [answers.genre, answers.producerGoal, goal, t]);

  const planInsight = useMemo(() => {
    if (answers.producerGoal) {
      return t(`onboarding.quiz.plan.insights.${answers.producerGoal}`, { count: goal });
    }
    return t("onboarding.quiz.plan.insightFallback", { count: goal });
  }, [answers.producerGoal, goal, t]);

  const planPremiumLine = useMemo(() => {
    if (answers.producerGoal) {
      return t(`onboarding.quiz.plan.premium.${answers.producerGoal}`);
    }
    return t("onboarding.quiz.plan.premiumFallback");
  }, [answers.producerGoal, t]);

  if (step === "welcome") {
    return (
      <SafeAreaView style={styles.welcomeSafe} edges={["top", "bottom"]}>
        <Pressable accessibilityRole="button" style={styles.welcomeSkip} onPress={goToWeeklyGoal}>
          <Text style={styles.welcomeSkipTxt}>{t("onboarding.skip")}</Text>
        </Pressable>
        <View style={styles.welcomeBody}>
          <ProdifyWordmark size="hero" />
          <Text style={styles.welcomeTitle}>{t("onboarding.quiz.welcome.title")}</Text>
          <Text style={styles.welcomeSubtitle}>{t("onboarding.quiz.welcome.subtitle")}</Text>
        </View>
        <PrimaryButton
          label={t("onboarding.quiz.welcome.cta")}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setStep("experience");
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === "experience") {
    return (
      <OnboardingQuizShell
        stepIndex={0}
        totalSteps={QUIZ_STEPS}
        title={t("onboarding.quiz.experience.title")}
        subtitle={t("onboarding.quiz.experience.subtitle")}
        onBack={() => setStep("welcome")}
        onSkip={goToWeeklyGoal}
        skipLabel={t("onboarding.skip")}
      >
        {EXPERIENCE_OPTIONS.map((opt, index) => (
          <QuizOptionCard
            key={opt.id}
            index={index}
            icon={opt.icon}
            label={experienceLabel(opt.id, t)}
            hint={t(opt.hintKey)}
            selected={answers.experience === opt.id}
            onPress={() => pickExperience(opt.id)}
          />
        ))}
      </OnboardingQuizShell>
    );
  }

  if (step === "genre") {
    return (
      <OnboardingQuizShell
        stepIndex={1}
        totalSteps={QUIZ_STEPS}
        title={t("onboarding.quiz.genre.title")}
        subtitle={t("onboarding.quiz.genre.subtitle")}
        onBack={() => setStep("experience")}
        onSkip={goToWeeklyGoal}
        skipLabel={t("onboarding.skip")}
      >
        {GENRE_OPTIONS.map((opt, index) => (
          <QuizOptionCard
            key={opt.id}
            index={index}
            icon={opt.icon}
            label={genreLabel(opt.id, t)}
            selected={answers.genre === opt.id}
            onPress={() => pickGenre(opt.id)}
          />
        ))}
      </OnboardingQuizShell>
    );
  }

  if (step === "producerGoal") {
    return (
      <OnboardingQuizShell
        stepIndex={2}
        totalSteps={QUIZ_STEPS}
        title={t("onboarding.quiz.producerGoal.title")}
        subtitle={t("onboarding.quiz.producerGoal.subtitle")}
        onBack={() => setStep("genre")}
        onSkip={goToWeeklyGoal}
        skipLabel={t("onboarding.skip")}
      >
        {PRODUCER_GOAL_OPTIONS.map((opt, index) => (
          <QuizOptionCard
            key={opt.id}
            index={index}
            icon={opt.icon}
            label={producerGoalLabel(opt.id, t)}
            selected={answers.producerGoal === opt.id}
            onPress={() => pickProducerGoal(opt.id)}
          />
        ))}
      </OnboardingQuizShell>
    );
  }

  if (step === "weeklyGoal") {
    return (
      <OnboardingQuizShell
        stepIndex={3}
        totalSteps={QUIZ_STEPS}
        title={t("onboarding.quiz.weeklyGoal.title")}
        subtitle={t("onboarding.quiz.weeklyGoal.subtitle")}
        onBack={() => setStep(answers.producerGoal ? "producerGoal" : "welcome")}
        onSkip={() => setStep("plan")}
        skipLabel={t("onboarding.skip")}
        footer={
          <PrimaryButton
            label={t("onboarding.quiz.weeklyGoal.cta")}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setStep("plan");
            }}
          />
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.goalScroll}>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => (
              <Pressable
                key={g}
                style={[styles.goalCard, goal === g && styles.goalCardOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setAnswers((prev) => ({ ...prev, weeklyGoal: g }));
                }}
              >
                <Text style={[styles.goalCardValue, goal === g && styles.goalCardValueOn]}>
                  {g}
                </Text>
                <Text style={[styles.goalCardLabel, goal === g && styles.goalCardLabelOn]}>
                  {t("onboarding.quiz.weeklyGoal.perWeek")}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.goalInfoCard}>
            <Text style={styles.goalInfoTitle}>
              {t("onboarding.quiz.weeklyGoal.previewTitle", { goal })}
            </Text>
            <Text style={styles.goalInfoBody}>
              {t("onboarding.quiz.weeklyGoal.previewBody", {
                daily: dailyTargetDisplay,
                unit: dailyTargetUnit,
              })}
            </Text>
          </View>
        </ScrollView>
      </OnboardingQuizShell>
    );
  }

  if (step === "plan") {
    return (
      <OnboardingQuizShell
        stepIndex={4}
        totalSteps={QUIZ_STEPS}
        title={t("onboarding.quiz.plan.title")}
        subtitle={t("onboarding.quiz.plan.subtitle")}
        onBack={() => setStep("weeklyGoal")}
        footer={
          <PrimaryButton
            label={t("onboarding.quiz.plan.cta")}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              setStep("notifications");
            }}
          />
        }
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <OnboardingPlanSummary
            rows={planRows}
            insight={planInsight}
            premiumLine={planPremiumLine}
          />
        </ScrollView>
      </OnboardingQuizShell>
    );
  }

  return (
    <SafeAreaView style={styles.notifSafe} edges={["top", "bottom"]}>
      <View style={styles.notifBody}>
        <Text style={styles.notifTitle}>
          {t("onboarding.notifications.titlePrefix")}{" "}
          <Text style={styles.loopAccent}>{t("onboarding.notifications.titleLoop")}</Text>
        </Text>
        <Text style={styles.notifSubtitle}>{t("onboarding.notifications.body")}</Text>
        <View style={styles.notifCard}>
          <Text style={styles.notifCardTitle}>{t("onboarding.notifications.visualTitle")}</Text>
          <Text style={styles.notifBenefit}>{t("onboarding.notifications.benefit1")}</Text>
          <Text style={styles.notifBenefit}>{t("onboarding.notifications.benefit2")}</Text>
          <Text style={styles.notifBenefit}>{t("onboarding.notifications.benefit3")}</Text>
        </View>
      </View>
      <PrimaryButton
        label={t("onboarding.notifications.enable")}
        onPress={requestNotif}
        loading={busy}
      />
      <Pressable style={styles.secondaryBtn} onPress={finish} disabled={busy}>
        <Text style={styles.secondaryTxt}>{t("onboarding.notifications.notNow")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  welcomeSafe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  welcomeSkip: { alignSelf: "flex-end" },
  welcomeSkipTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  welcomeBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  welcomeTitle: {
    marginTop: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
    letterSpacing: -0.8,
  },
  welcomeSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  goalScroll: { gap: spacing.md, paddingBottom: spacing.sm },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  goalCard: {
    width: "48%",
    minHeight: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  goalCardOn: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.1)",
  },
  goalCardValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 32,
  },
  goalCardValueOn: { color: colors.primary },
  goalCardLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  goalCardLabelOn: { color: colors.textPrimary },
  goalInfoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: spacing.md,
    gap: 4,
  },
  goalInfoTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  goalInfoBody: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  notifSafe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  notifBody: { flex: 1, justifyContent: "center", gap: spacing.sm },
  notifTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
  },
  loopAccent: { color: colors.primary, fontFamily: fontFamily.heading },
  notifSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
  },
  notifCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  notifCardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginBottom: spacing.xs,
  },
  notifBenefit: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  secondaryBtn: { alignItems: "center", paddingVertical: spacing.md },
  secondaryTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
