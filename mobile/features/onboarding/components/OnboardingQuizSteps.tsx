import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { OnboardingPlanSummary } from "../../../components/onboarding/OnboardingPlanSummary";
import { OnboardingQuizShell } from "../../../components/onboarding/OnboardingQuizShell";
import { QuizOptionCard } from "../../../components/onboarding/QuizOptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { experienceLabel, genreLabel, producerGoalLabel } from "../../../lib/onboardingQuiz";
import { onboardingStyles as styles } from "../onboarding.styles";
import {
  EXPERIENCE_OPTIONS,
  GENRE_OPTIONS,
  INTRO_SLIDE_COUNT,
  PRODUCER_GOAL_OPTIONS,
  QUIZ_STEP_COUNT,
  WEEKLY_GOALS,
} from "../onboardingConfig";
import type { OnboardingPresentation } from "../hooks/useOnboardingPresentation";
import type { OnboardingWorkflow } from "../hooks/useOnboardingWorkflow";

type Props = { workflow: OnboardingWorkflow; presentation: OnboardingPresentation };

export function OnboardingQuizSteps(props: Props) {
  switch (props.workflow.step) {
    case "experience":
      return <ExperienceStep {...props} />;
    case "genre":
      return <GenreStep {...props} />;
    case "producerGoal":
      return <ProducerGoalStep {...props} />;
    case "weeklyGoal":
      return <WeeklyGoalStep {...props} />;
    case "plan":
      return <PlanStep {...props} />;
    default:
      return null;
  }
}

function ExperienceStep({ workflow }: Props) {
  const { t } = useTranslation();
  const goBack = () => {
    workflow.setIntroIndex(INTRO_SLIDE_COUNT - 1);
    workflow.setStep("intro");
  };
  return (
    <OnboardingQuizShell
      testID="onboarding-experience"
      stepIndex={0}
      totalSteps={QUIZ_STEP_COUNT}
      title={t("onboarding.quiz.experience.title")}
      subtitle={t("onboarding.quiz.experience.subtitle")}
      onBack={goBack}
      onSkip={workflow.skipPersonalization}
      skipLabel={t("onboarding.skip")}
    >
      {EXPERIENCE_OPTIONS.map((option, index) => (
        <QuizOptionCard
          key={option.id}
          index={index}
          icon={option.icon}
          label={experienceLabel(option.id, t)}
          hint={t(option.hintKey)}
          selected={workflow.answers.experience === option.id}
          onPress={() => workflow.pickExperience(option.id)}
        />
      ))}
    </OnboardingQuizShell>
  );
}

function GenreStep({ workflow }: Props) {
  const { t } = useTranslation();
  return (
    <OnboardingQuizShell
      testID="onboarding-genre"
      stepIndex={1}
      totalSteps={QUIZ_STEP_COUNT}
      title={t("onboarding.quiz.genre.title")}
      subtitle={t("onboarding.quiz.genre.subtitle")}
      onBack={() => workflow.setStep("experience")}
      onSkip={workflow.skipPersonalization}
      skipLabel={t("onboarding.skip")}
    >
      {GENRE_OPTIONS.map((option, index) => (
        <QuizOptionCard
          key={option.id}
          index={index}
          icon={option.icon}
          label={genreLabel(option.id, t)}
          selected={workflow.answers.genre === option.id}
          onPress={() => workflow.pickGenre(option.id)}
        />
      ))}
    </OnboardingQuizShell>
  );
}

function ProducerGoalStep({ workflow }: Props) {
  const { t } = useTranslation();
  return (
    <OnboardingQuizShell
      testID="onboarding-producer-goal"
      stepIndex={2}
      totalSteps={QUIZ_STEP_COUNT}
      title={t("onboarding.quiz.producerGoal.title")}
      subtitle={t("onboarding.quiz.producerGoal.subtitle")}
      onBack={() => workflow.setStep("genre")}
      onSkip={workflow.skipPersonalization}
      skipLabel={t("onboarding.skip")}
    >
      {PRODUCER_GOAL_OPTIONS.map((option, index) => (
        <QuizOptionCard
          key={option.id}
          index={index}
          icon={option.icon}
          label={producerGoalLabel(option.id, t)}
          selected={workflow.answers.producerGoal === option.id}
          onPress={() => workflow.pickProducerGoal(option.id)}
        />
      ))}
    </OnboardingQuizShell>
  );
}

function WeeklyGoalStep({ workflow, presentation }: Props) {
  const { t } = useTranslation();
  const continueToPlan = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    workflow.setStep("plan");
  };
  return (
    <OnboardingQuizShell
      testID="onboarding-weekly-goal"
      stepIndex={3}
      totalSteps={QUIZ_STEP_COUNT}
      title={t("onboarding.quiz.weeklyGoal.title")}
      subtitle={t("onboarding.quiz.weeklyGoal.subtitle")}
      onBack={() => workflow.setStep(workflow.answers.producerGoal ? "producerGoal" : "experience")}
      onSkip={() => workflow.setStep("plan")}
      skipLabel={t("onboarding.skip")}
      footer={
        <PrimaryButton label={t("onboarding.quiz.weeklyGoal.cta")} onPress={continueToPlan} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.goalScroll}>
        <View style={styles.goalGrid}>
          {WEEKLY_GOALS.map((goal) => (
            <WeeklyGoalOption key={goal} goal={goal} workflow={workflow} />
          ))}
        </View>
        <View style={styles.goalInfoCard}>
          <Text style={styles.goalInfoTitle}>
            {t("onboarding.quiz.weeklyGoal.previewTitle", { goal: workflow.weeklyGoal })}
          </Text>
          <Text style={styles.goalInfoBody}>
            {t("onboarding.quiz.weeklyGoal.previewBody", {
              daily: presentation.dailyTargetDisplay,
              unit: presentation.dailyTargetUnit,
            })}
          </Text>
        </View>
      </ScrollView>
    </OnboardingQuizShell>
  );
}

function WeeklyGoalOption({ goal, workflow }: { goal: number; workflow: OnboardingWorkflow }) {
  const { t } = useTranslation();
  const selected = workflow.weeklyGoal === goal;
  const select = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    workflow.selectWeeklyGoal(goal);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t("onboarding.quiz.weeklyGoal.optionLabel", { count: goal })}
      style={[styles.goalCard, selected && styles.goalCardOn]}
      onPress={select}
    >
      <Text style={[styles.goalCardValue, selected && styles.goalCardValueOn]}>{goal}</Text>
      <Text style={[styles.goalCardLabel, selected && styles.goalCardLabelOn]}>
        {t("onboarding.quiz.weeklyGoal.perWeek")}
      </Text>
    </Pressable>
  );
}

function PlanStep({ workflow, presentation }: Props) {
  const { t } = useTranslation();
  const finish = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    void workflow.finish();
  };
  return (
    <OnboardingQuizShell
      testID="onboarding-plan"
      stepIndex={4}
      totalSteps={QUIZ_STEP_COUNT}
      title={t("onboarding.quiz.plan.title")}
      subtitle={t("onboarding.quiz.plan.subtitle")}
      onBack={() => workflow.setStep("weeklyGoal")}
      footer={
        <PrimaryButton
          label={t("onboarding.quiz.plan.cta")}
          onPress={finish}
          loading={workflow.busy}
        />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <OnboardingPlanSummary
          rows={presentation.planRows}
          insight={presentation.planInsight}
          accessLine={presentation.planAccessLine}
        />
      </ScrollView>
    </OnboardingQuizShell>
  );
}
