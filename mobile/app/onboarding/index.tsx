import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingPlanSummary } from "../../components/onboarding/OnboardingPlanSummary";
import { OnboardingQuizShell } from "../../components/onboarding/OnboardingQuizShell";
import { QuizOptionCard } from "../../components/onboarding/QuizOptionCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { onboardingStyles as styles } from "../../features/onboarding/onboarding.styles";
import {
  EXPERIENCE_OPTIONS,
  GENRE_OPTIONS,
  INTRO_SLIDE_COUNT,
  PRODUCER_GOAL_OPTIONS,
  QUIZ_STEP_COUNT,
  WEEKLY_GOALS,
} from "../../features/onboarding/onboardingConfig";
import { experienceLabel, genreLabel, producerGoalLabel } from "../../lib/onboardingQuiz";
import { useOnboardingWorkflow } from "../../features/onboarding/hooks/useOnboardingWorkflow";
import { useOnboardingPresentation } from "../../features/onboarding/hooks/useOnboardingPresentation";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const {
    step,
    setStep,
    introIndex,
    setIntroIndex,
    answers,
    weeklyGoal: goal,
    busy,
    skipIntro,
    skipPersonalization,
    openLogin,
    nextIntroSlide,
    pickExperience,
    pickGenre,
    pickProducerGoal,
    selectWeeklyGoal,
    finish,
  } = useOnboardingWorkflow();
  const floatY = useSharedValue(0);
  const parallaxX = useSharedValue(0);

  const visualFloat = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { translateX: parallaxX.value }],
  }));

  const copyParallax = useAnimatedStyle(() => ({
    transform: [{ translateX: -parallaxX.value * 0.6 }],
  }));

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [floatY]);

  useEffect(() => {
    if (step !== "intro") return;
    parallaxX.value = 14;
    parallaxX.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [introIndex, parallaxX, step]);

  const {
    introSlides,
    dailyTargetDisplay,
    dailyTargetUnit,
    planRows,
    planInsight,
    planAccessLine,
  } = useOnboardingPresentation(answers, goal);

  if (step === "intro") {
    const slide = introSlides[introIndex];
    return (
      <SafeAreaView testID="onboarding-intro" style={styles.introSafe} edges={["top", "bottom"]}>
        <View style={styles.introTopRow}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={openLogin}>
            <Text style={styles.introSignIn}>{t("onboarding.existingAccount")}</Text>
          </Pressable>
          <View style={styles.introTopRight}>
            <Text
              accessibilityLabel={`${introIndex + 1} of ${INTRO_SLIDE_COUNT}`}
              style={styles.introDots}
            >
              {introIndex + 1}/{INTRO_SLIDE_COUNT}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={skipIntro}>
              <Text style={styles.introSkip}>{t("onboarding.skip")}</Text>
            </Pressable>
          </View>
        </View>
        <Animated.View
          key={`intro-${introIndex}`}
          entering={FadeInDown.duration(320)}
          style={styles.introSlide}
        >
          <Animated.View
            style={[styles.introVisualWrap, visualFloat]}
            entering={FadeInUp.duration(360)}
          >
            <Animated.Image
              key={`intro-visual-${introIndex}`}
              source={slide.image}
              style={styles.introVisualImage}
              resizeMode="cover"
              fadeDuration={0}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(180)}
            />
            {introIndex < introSlides.length - 1 ? (
              <Image
                source={introSlides[introIndex + 1].image}
                style={styles.introHiddenPreload}
                fadeDuration={0}
              />
            ) : null}
          </Animated.View>
          <Animated.View style={[styles.introCopyWrap, copyParallax]}>
            <Text style={styles.introHeroTitle}>{slide.title}</Text>
            <Text style={styles.introHeroBody}>{slide.body}</Text>
          </Animated.View>
        </Animated.View>
        <View style={styles.introBottom}>
          <View style={styles.introPaginationRow}>
            {introSlides.map((_, idx) => (
              <View
                key={`intro-dot-${idx}`}
                style={[styles.introPageDot, idx === introIndex && styles.introPageDotActive]}
              />
            ))}
          </View>
          <PrimaryButton
            label={
              introIndex === introSlides.length - 1
                ? t("onboarding.continue")
                : t("onboarding.next")
            }
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              nextIntroSlide();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (step === "experience") {
    return (
      <OnboardingQuizShell
        testID="onboarding-experience"
        stepIndex={0}
        totalSteps={QUIZ_STEP_COUNT}
        title={t("onboarding.quiz.experience.title")}
        subtitle={t("onboarding.quiz.experience.subtitle")}
        onBack={() => {
          setIntroIndex(INTRO_SLIDE_COUNT - 1);
          setStep("intro");
        }}
        onSkip={skipPersonalization}
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
        testID="onboarding-genre"
        stepIndex={1}
        totalSteps={QUIZ_STEP_COUNT}
        title={t("onboarding.quiz.genre.title")}
        subtitle={t("onboarding.quiz.genre.subtitle")}
        onBack={() => setStep("experience")}
        onSkip={skipPersonalization}
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
        testID="onboarding-producer-goal"
        stepIndex={2}
        totalSteps={QUIZ_STEP_COUNT}
        title={t("onboarding.quiz.producerGoal.title")}
        subtitle={t("onboarding.quiz.producerGoal.subtitle")}
        onBack={() => setStep("genre")}
        onSkip={skipPersonalization}
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
        testID="onboarding-weekly-goal"
        stepIndex={3}
        totalSteps={QUIZ_STEP_COUNT}
        title={t("onboarding.quiz.weeklyGoal.title")}
        subtitle={t("onboarding.quiz.weeklyGoal.subtitle")}
        onBack={() => setStep(answers.producerGoal ? "producerGoal" : "experience")}
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
            {WEEKLY_GOALS.map((g) => (
              <Pressable
                key={g}
                accessibilityRole="button"
                accessibilityState={{ selected: goal === g }}
                accessibilityLabel={t("onboarding.quiz.weeklyGoal.optionLabel", { count: g })}
                style={[styles.goalCard, goal === g && styles.goalCardOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  selectWeeklyGoal(g);
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
        testID="onboarding-plan"
        stepIndex={4}
        totalSteps={QUIZ_STEP_COUNT}
        title={t("onboarding.quiz.plan.title")}
        subtitle={t("onboarding.quiz.plan.subtitle")}
        onBack={() => setStep("weeklyGoal")}
        footer={
          <PrimaryButton
            label={t("onboarding.quiz.plan.cta")}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              void finish();
            }}
            loading={busy}
          />
        }
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <OnboardingPlanSummary
            rows={planRows}
            insight={planInsight}
            accessLine={planAccessLine}
          />
        </ScrollView>
      </OnboardingQuizShell>
    );
  }

  return null;
}
