import { Calendar, Music2, Target } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  genreLabel,
  producerGoalLabel,
  type OnboardingQuizAnswers,
} from "../../../lib/onboardingQuiz";
import { ONBOARDING_VISUALS } from "../onboardingConfig";

export function useOnboardingPresentation(answers: OnboardingQuizAnswers, weeklyGoal: number) {
  const { t } = useTranslation();

  const introSlides = useMemo(
    () => [
      {
        title: t("onboarding.slide1.title"),
        body: t("onboarding.slide1.body"),
        image: ONBOARDING_VISUALS[0],
      },
      {
        title: t("onboarding.slide2.title"),
        body: t("onboarding.slide2.body"),
        image: ONBOARDING_VISUALS[1],
      },
      {
        title: t("onboarding.slide3.title"),
        body: t("onboarding.slide3.body"),
        image: ONBOARDING_VISUALS[2],
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
      value: t("onboarding.quiz.plan.weeklyValue", { count: weeklyGoal }),
    });
    return rows;
  }, [answers.genre, answers.producerGoal, t, weeklyGoal]);

  const planInsight = answers.producerGoal
    ? t(`onboarding.quiz.plan.insights.${answers.producerGoal}`, { count: weeklyGoal })
    : t("onboarding.quiz.plan.insightFallback", { count: weeklyGoal });
  const planAccessLine = answers.producerGoal
    ? t(`onboarding.quiz.plan.access.${answers.producerGoal}`)
    : t("onboarding.quiz.plan.accessFallback");

  return {
    introSlides,
    dailyTargetDisplay,
    dailyTargetUnit,
    planRows,
    planInsight,
    planAccessLine,
  };
}
