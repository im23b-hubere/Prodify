import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ONBOARDING_VIDEOS } from "../onboardingConfig";

export function useOnboardingPresentation(weeklyGoal: number) {
  const { t } = useTranslation();

  const introSlides = useMemo(
    () => [
      {
        title: t("onboarding.slide1.title"),
        emphasis: t("onboarding.slide1.emphasis"),
        body: t("onboarding.slide1.body"),
        video: ONBOARDING_VIDEOS[0]!,
      },
      {
        title: t("onboarding.slide2.title"),
        emphasis: t("onboarding.slide2.emphasis"),
        body: t("onboarding.slide2.body"),
        video: ONBOARDING_VIDEOS[1]!,
      },
      {
        title: t("onboarding.slide3.title"),
        emphasis: t("onboarding.slide3.emphasis"),
        body: t("onboarding.slide3.body"),
        video: ONBOARDING_VIDEOS[2]!,
      },
    ],
    [t],
  );

  const dailyTarget = Math.max(1, Math.round((weeklyGoal / 7) * 10) / 10);
  const dailyTargetDisplay = Number.isInteger(dailyTarget)
    ? String(dailyTarget)
    : dailyTarget.toFixed(1);
  const dailyTargetUnit = t(
    dailyTarget === 1
      ? "onboarding.quiz.weeklyGoal.session"
      : "onboarding.quiz.weeklyGoal.sessions",
  );

  return {
    introSlides,
    dailyTargetDisplay,
    dailyTargetUnit,
  };
}

export type OnboardingPresentation = ReturnType<typeof useOnboardingPresentation>;
