import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TFunction } from "i18next";

import { ONBOARDING_QUIZ_KEY } from "../constants/storageKeys";

export type ProducerExperience = "under_1y" | "1_3y" | "3_5y" | "5y_plus";
export type ProducerGenre = "hip_hop" | "edm" | "pop" | "other";
export type ProducerGoal = "more_output" | "consistency" | "finish_tracks" | "learn_skills";

export type OnboardingQuizAnswers = {
  experience?: ProducerExperience;
  genre?: ProducerGenre;
  producerGoal?: ProducerGoal;
  weeklyGoal?: number;
};

export async function saveOnboardingQuiz(answers: OnboardingQuizAnswers): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_QUIZ_KEY, JSON.stringify(answers));
}

export async function loadOnboardingQuiz(): Promise<OnboardingQuizAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_QUIZ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingQuizAnswers;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function experienceLabel(value: ProducerExperience, t: TFunction): string {
  return t(`onboarding.quiz.experience.options.${value}`);
}

export function genreLabel(value: ProducerGenre, t: TFunction): string {
  return t(`onboarding.quiz.genre.options.${value}`);
}

export function producerGoalLabel(value: ProducerGoal, t: TFunction): string {
  return t(`onboarding.quiz.producerGoal.options.${value}`);
}
