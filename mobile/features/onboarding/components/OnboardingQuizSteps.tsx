import * as Haptics from "expo-haptics";
import { ArrowLeft, Check, type LucideIcon } from "lucide-react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import { genreLabel, producerGoalLabel, yearsFromExperience } from "../../../lib/onboardingQuiz";
import type { OnboardingPresentation } from "../hooks/useOnboardingPresentation";
import type { OnboardingWorkflow } from "../hooks/useOnboardingWorkflow";
import { GENRE_OPTIONS, PRODUCER_GOAL_OPTIONS, QUIZ_STEPS } from "../onboardingConfig";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { OnboardingButton } from "./OnboardingButton";
import { OnboardingSegments } from "./OnboardingSegments";
import { WeeklyGoalPicker } from "./WeeklyGoalPicker";

type Props = { workflow: OnboardingWorkflow; presentation: OnboardingPresentation };
type QuizStep = (typeof QUIZ_STEPS)[number];

const QUESTION_KEYS: Record<QuizStep, { prefix: string; testID: string }> = {
  experience: { prefix: "onboarding.quiz.experience", testID: "onboarding-experience" },
  genre: { prefix: "onboarding.quiz.genre", testID: "onboarding-genre" },
  producerGoal: { prefix: "onboarding.quiz.producerGoal", testID: "onboarding-producer-goal" },
  weeklyGoal: { prefix: "onboarding.quiz.weeklyGoal", testID: "onboarding-weekly-goal" },
};

function Choice({
  index,
  icon: Icon,
  label,
  selected,
  onPick,
}: {
  index: number;
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(80 + index * 50)}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        onPress={onPick}
        style={({ pressed }) => [
          styles.choice,
          selected && styles.choiceSelected,
          pressed && styles.choicePressed,
        ]}
      >
        <Icon color={selected ? colors.primary : colors.textSecondary} size={21} strokeWidth={2} />
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
        <View style={[styles.choiceMark, selected && styles.choiceMarkSelected]}>
          {selected ? <Check size={14} color={colors.textPrimary} strokeWidth={3} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StepAnswers({ step, workflow, presentation }: Props & { step: QuizStep }) {
  const { t } = useTranslation();
  const pick = (apply: () => void) => {
    void Haptics.selectionAsync().catch(() => undefined);
    apply();
  };

  if (step === "experience") {
    const { experience, experienceYears } = workflow.answers;
    return (
      <ExperienceTimeline
        years={experienceYears ?? (experience ? yearsFromExperience(experience) : undefined)}
        onChange={workflow.pickExperienceYears}
      />
    );
  }
  if (step === "weeklyGoal") {
    return (
      <WeeklyGoalPicker
        value={workflow.weeklyGoal}
        onChange={workflow.selectWeeklyGoal}
        averageLine={t("onboarding.quiz.weeklyGoal.previewBody", {
          daily: presentation.dailyTargetDisplay,
          unit: presentation.dailyTargetUnit,
        })}
      />
    );
  }
  if (step === "genre") {
    return (
      <>
        {GENRE_OPTIONS.map((option, index) => (
          <Choice
            key={option.id}
            index={index}
            icon={option.icon}
            label={genreLabel(option.id, t)}
            selected={workflow.answers.genre === option.id}
            onPick={() => pick(() => workflow.pickGenre(option.id))}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {PRODUCER_GOAL_OPTIONS.map((option, index) => (
        <Choice
          key={option.id}
          index={index}
          icon={option.icon}
          label={producerGoalLabel(option.id, t)}
          selected={workflow.answers.producerGoal === option.id}
          onPick={() => pick(() => workflow.pickProducerGoal(option.id))}
        />
      ))}
    </>
  );
}

/**
 * The personalisation questions: back arrow and step segments on top, one question at a time
 * fading up into place, and the button docked at the bottom.
 */
export function OnboardingQuizSteps({ workflow, presentation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const step = workflow.step as QuizStep;
  const stepIndex = QUIZ_STEPS.indexOf(step);
  const keys = QUESTION_KEYS[step];
  // Forward questions rise from below; going back they drop in from above.
  const direction = useRef<"forward" | "back">("forward");

  const canProceed =
    (step === "experience" && Boolean(workflow.answers.experience)) ||
    (step === "genre" && Boolean(workflow.answers.genre)) ||
    (step === "producerGoal" && Boolean(workflow.answers.producerGoal)) ||
    step === "weeklyGoal";
  const isLastStep = step === "weeklyGoal";

  const goOn = () => {
    if (!canProceed) return;
    void Haptics.impactAsync(
      isLastStep ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => undefined);
    if (isLastStep) {
      workflow.buildProfile();
      return;
    }
    direction.current = "forward";
    workflow.nextQuizStep();
  };

  const goBack = () => {
    direction.current = "back";
    workflow.previousQuizStep();
  };

  const entering =
    direction.current === "forward"
      ? FadeInUp.duration(300).easing(Easing.out(Easing.cubic))
      : FadeInDown.duration(300).easing(Easing.out(Easing.cubic));

  return (
    <View testID={keys.testID} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={goBack}
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.2} />
        </Pressable>
        <OnboardingSegments count={QUIZ_STEPS.length} current={stepIndex} />
        <Text style={styles.counter}>
          {stepIndex + 1}/{QUIZ_STEPS.length}
        </Text>
      </View>

      <Animated.View key={step} entering={entering} style={styles.question}>
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
          {t(`${keys.prefix}.title`)}
        </Text>
        <Text style={styles.subtitle}>{t(`${keys.prefix}.subtitle`)}</Text>
        <ScrollView
          style={styles.answers}
          // The timeline is dragged sideways; a vertical scroll around it would fight the drag.
          scrollEnabled={step !== "experience"}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          contentContainerStyle={styles.answersContent}
        >
          <StepAnswers step={step} workflow={workflow} presentation={presentation} />
        </ScrollView>
      </Animated.View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + 14 }]}>
        <OnboardingButton
          label={isLastStep ? t("onboarding.quiz.weeklyGoal.cta") : t("onboarding.continue")}
          onPress={goOn}
          disabled={!canProceed}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: {
    opacity: 0.5,
  },
  counter: {
    minWidth: 30,
    marginRight: 6,
    textAlign: "right",
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
  },
  question: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 23,
  },
  answers: {
    flex: 1,
    marginTop: 22,
  },
  answersContent: {
    gap: 10,
    paddingBottom: 24,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: "#170d09",
  },
  choicePressed: {
    transform: [{ scale: 0.985 }],
  },
  choiceLabel: {
    flex: 1,
    color: "#d4d4d4",
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
  },
  choiceLabelSelected: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  choiceMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceMarkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dock: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
