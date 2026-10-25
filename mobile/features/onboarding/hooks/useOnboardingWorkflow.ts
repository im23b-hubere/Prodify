import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Href, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  ONBOARDING_COMPLETE_KEY,
  PENDING_WEEKLY_GOAL_KEY,
} from "../../../constants/storageKeys";
import { useAuth } from "../../../context/AuthContext";
import { hasPremiumAccess, peekCachedHasPremiumAccess } from "../../../lib/billing";
import { apiJson } from "../../../lib/client";
import { loadPersistedEntitlement } from "../../../lib/entitlementStorage";
import { savePendingWeeklyGoal } from "../../../lib/onboardingGoalSync";
import {
  experienceFromYears,
  saveOnboardingQuiz,
  type OnboardingQuizAnswers,
  type ProducerGenre,
  type ProducerGoal,
} from "../../../lib/onboardingQuiz";
import { resolvePremiumAccess } from "../../../lib/premiumAccess";
import { INTRO_SLIDE_COUNT, QUIZ_STEPS, type OnboardingStep } from "../onboardingConfig";

type OnboardingUser = { id?: number | null; is_premium?: boolean | null } | null;
type OnboardingDestination = "dashboard" | "register" | "paywall";
type AppRouter = { replace: (href: Href) => void };

async function syncWeeklyGoal(token: string | null, weeklyGoal: number): Promise<void> {
  await savePendingWeeklyGoal(weeklyGoal).catch(() => undefined);
  if (!token) return;
  try {
    await apiJson("/goals/set", {
      token,
      method: "POST",
      body: { goal_type: "weekly_sessions", target_value: weeklyGoal },
    });
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
  if (token && user && (await userHasPremium(token, user))) return "dashboard";
  return token ? "paywall" : "register";
}

function navigateAfterOnboarding(router: AppRouter, destination: OnboardingDestination): void {
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
  const pendingDestination = useRef<Promise<OnboardingDestination> | null>(null);
  const weeklyGoal = answers.weeklyGoal ?? 7;

  // Answers only select; the survey's Continue button moves on.
  const pickExperienceYears = useCallback((experienceYears: number) => {
    setAnswers((current) => ({
      ...current,
      experienceYears,
      experience: experienceFromYears(experienceYears),
    }));
  }, []);

  const pickGenre = useCallback((genre: ProducerGenre) => {
    setAnswers((current) => ({ ...current, genre }));
  }, []);

  const pickProducerGoal = useCallback((producerGoal: ProducerGoal) => {
    setAnswers((current) => ({ ...current, producerGoal }));
  }, []);

  /** The next quiz step, or back from the first one to the last intro slide. */
  const nextQuizStep = useCallback(() => {
    const index = QUIZ_STEPS.indexOf(step as (typeof QUIZ_STEPS)[number]);
    if (index >= 0 && index < QUIZ_STEPS.length - 1) setStep(QUIZ_STEPS[index + 1]);
  }, [step]);

  const previousQuizStep = useCallback(() => {
    const index = QUIZ_STEPS.indexOf(step as (typeof QUIZ_STEPS)[number]);
    if (index > 0) {
      setStep(QUIZ_STEPS[index - 1]);
      return;
    }
    setIntroIndex(INTRO_SLIDE_COUNT - 1);
    setStep("intro");
  }, [step]);

  /** Saves the answers in the background while the profile animation plays. */
  const buildProfile = useCallback(() => {
    pendingDestination.current = completeOnboarding({ answers, weeklyGoal, token, user }).catch(
      (): OnboardingDestination => (token ? "paywall" : "register"),
    );
    setStep("building");
  }, [answers, token, user, weeklyGoal]);

  /** Once the animation has finished: on to wherever the saved answers lead. */
  const leaveBuiltProfile = useCallback(async () => {
    const destination = await (pendingDestination.current ??
      completeOnboarding({ answers, weeklyGoal, token, user }));
    navigateAfterOnboarding(router, destination);
  }, [answers, router, token, user, weeklyGoal]);

  return {
    step,
    setStep,
    introIndex,
    setIntroIndex,
    answers,
    weeklyGoal,
    signedIn: Boolean(token),
    skipIntro: () => setStep("experience"),
    openLogin: () =>
      router.replace({
        pathname: "/(auth)/login",
        params: { next: "paywall", source: "existing_account", variant: "value" },
      }),
    nextIntroSlide: () => {
      if (introIndex >= INTRO_SLIDE_COUNT - 1) setStep("experience");
      else setIntroIndex((current) => current + 1);
    },
    pickExperienceYears,
    pickGenre,
    pickProducerGoal,
    nextQuizStep,
    previousQuizStep,
    selectWeeklyGoal: (goal: number) => setAnswers((current) => ({ ...current, weeklyGoal: goal })),
    buildProfile,
    leaveBuiltProfile,
  };
}

export type OnboardingWorkflow = ReturnType<typeof useOnboardingWorkflow>;
