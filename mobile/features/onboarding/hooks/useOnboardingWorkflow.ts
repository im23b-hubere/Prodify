import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
      await saveOnboardingQuiz({ ...answers, weeklyGoal }).catch(() => undefined);
      await savePendingWeeklyGoal(weeklyGoal).catch(() => undefined);
      if (token) {
        try {
          await apiJson("/goals/set", {
            token,
            method: "POST",
            body: { goal_type: "weekly_sessions", target_value: weeklyGoal },
          });
          await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
          await AsyncStorage.removeItem(PENDING_WEEKLY_GOAL_KEY).catch(() => undefined);
        } catch {
          // Goal synchronization is retried from the authenticated app.
        }
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1").catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      if (token && user?.id != null) {
        const cachedAccess =
          Boolean(user.is_premium) ||
          peekCachedHasPremiumAccess(token) === true ||
          hasPremiumAccess(await loadPersistedEntitlement(user.id).catch(() => null));
        const premiumAccess =
          cachedAccess || (await resolvePremiumAccess(token, String(user.id)).catch(() => false));
        if (premiumAccess) {
          router.replace("/(tabs)/dashboard");
          return;
        }
      }

      if (!token) {
        router.replace({
          pathname: "/(auth)/register",
          params: { next: "paywall", source: "onboarding", variant: "outcome" },
        });
        return;
      }
      router.replace({
        pathname: "/paywall",
        params: { source: "onboarding", variant: "outcome" },
      });
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
