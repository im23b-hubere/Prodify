import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { Router } from "expo-router";
import { useCallback, useState } from "react";

import {
  ONBOARDING_COMPLETE_KEY,
  PENDING_WEEKLY_GOAL_KEY,
  WEEKLY_GOAL_CONFIGURED_KEY,
} from "../../../constants/storageKeys";
import { useAuth } from "../../../context/AuthContext";
import { hasPremiumAccess, peekCachedHasPremiumAccess } from "../../../lib/billing";
import { apiJson } from "../../../lib/client";
import { loadPersistedEntitlement } from "../../../lib/entitlementStorage";
import { savePendingWeeklyGoal } from "../../../lib/onboardingGoalSync";
import {
  saveOnboardingQuiz,
  type OnboardingQuizAnswers,
  type ProducerExperience,
  type ProducerGenre,
  type ProducerGoal,
} from "../../../lib/onboardingQuiz";
import { resolvePremiumAccess } from "../../../lib/premiumAccess";
import { INTRO_SLIDE_COUNT, type OnboardingStep } from "../onboardingConfig";

const QUIZ_ADVANCE_DELAY_MS = 200;

type OnboardingUser = { id?: number | null; is_premium?: boolean | null } | null;
type OnboardingDestination = "dashboard" | "register" | "paywall";

async function syncWeeklyGoal(token: string | null, weeklyGoal: number): Promise<void> {
  await savePendingWeeklyGoal(weeklyGoal).catch(() => undefined);
  if (!token) return;
  try {
    await apiJson("/goals/set", {
      token,
      method: "POST",
      body: { goal_type: "weekly_sessions", target_value: weeklyGoal },
    });
    await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
    await AsyncStorage.removeItem(PENDING_WEEKLY_GOAL_KEY).catch(() => undefined);
  } catch {
    // The authenticated app retries pending goal synchronization.
  }
}

async function userHasPremium(token: string, user: NonNullable<OnboardingUser>): Promise<boolean> {
  if (user.id == null) return false;
  const cachedAccess =
    Boolean(user.is_premium) ||
    peekCachedHasPremiumAccess(token) === true ||
    hasPremiumAccess(await loadPersistedEntitlement(user.id).catch(() => null));
  return cachedAccess || (await resolvePremiumAccess(token, String(user.id)).catch(() => false));
}

export async function completeOnboarding(input: {
  answers: OnboardingQuizAnswers;
  weeklyGoal: number;
  token: string | null;
  user: OnboardingUser;
}): Promise<OnboardingDestination> {
  const { answers, weeklyGoal, token, user } = input;
  await saveOnboardingQuiz({ ...answers, weeklyGoal }).catch(() => undefined);
  await syncWeeklyGoal(token, weeklyGoal);
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1").catch(() => undefined);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (token && user && (await userHasPremium(token, user))) return "dashboard";
  return token ? "paywall" : "register";
}

function navigateAfterOnboarding(router: Router, destination: OnboardingDestination): void {
  if (destination === "dashboard") {
    router.replace("/(tabs)/dashboard");
    return;
  }
  if (destination === "register") {
    router.replace({
      pathname: "/(auth)/register",
      params: { next: "paywall", source: "onboarding", variant: "outcome" },
    });
    return;
  }
  router.replace({ pathname: "/paywall", params: { source: "onboarding", variant: "outcome" } });
}

export function useOnboardingWorkflow() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [introIndex, setIntroIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingQuizAnswers>({ weeklyGoal: 7 });
  const [busy, setBusy] = useState(false);
  const weeklyGoal = answers.weeklyGoal ?? 7;

  const advanceQuiz = useCallback((nextStep: OnboardingStep) => {
    setTimeout(() => setStep(nextStep), QUIZ_ADVANCE_DELAY_MS);
  }, []);

  const pickExperience = useCallback(
    (experience: ProducerExperience) => {
      setAnswers((current) => ({ ...current, experience }));
      advanceQuiz("genre");
    },
    [advanceQuiz],
  );

  const pickGenre = useCallback(
    (genre: ProducerGenre) => {
      setAnswers((current) => ({ ...current, genre }));
      advanceQuiz("producerGoal");
    },
    [advanceQuiz],
  );

  const pickProducerGoal = useCallback(
    (producerGoal: ProducerGoal) => {
      setAnswers((current) => ({ ...current, producerGoal }));
      advanceQuiz("weeklyGoal");
    },
    [advanceQuiz],
  );

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      const destination = await completeOnboarding({ answers, weeklyGoal, token, user });
      navigateAfterOnboarding(router, destination);
    } finally {
      setBusy(false);
    }
  }, [answers, router, token, user, weeklyGoal]);

  return {
    step,
    setStep,
    introIndex,
    setIntroIndex,
    answers,
    weeklyGoal,
    busy,
    skipIntro: () => setStep("experience"),
    skipPersonalization: () => setStep("weeklyGoal"),
    openLogin: () =>
      router.replace({
        pathname: "/(auth)/login",
        params: { next: "paywall", source: "existing_account", variant: "value" },
      }),
    nextIntroSlide: () => {
      if (introIndex >= INTRO_SLIDE_COUNT - 1) setStep("experience");
      else setIntroIndex((current) => current + 1);
    },
    pickExperience,
    pickGenre,
    pickProducerGoal,
    selectWeeklyGoal: (goal: number) => setAnswers((current) => ({ ...current, weeklyGoal: goal })),
    finish,
  };
}

export type OnboardingWorkflow = ReturnType<typeof useOnboardingWorkflow>;
