import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";
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

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { onboardingStyles as styles } from "../onboarding.styles";
import { INTRO_SLIDE_COUNT } from "../onboardingConfig";
import type { OnboardingPresentation } from "../hooks/useOnboardingPresentation";
import type { OnboardingWorkflow } from "../hooks/useOnboardingWorkflow";

type Props = {
  workflow: OnboardingWorkflow;
  slides: OnboardingPresentation["introSlides"];
};

export function OnboardingIntro({ workflow, slides }: Props) {
  const { t } = useTranslation();
  const motion = useIntroMotion(workflow.introIndex);
  const slide = slides[workflow.introIndex];
  const continueIntro = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    workflow.nextIntroSlide();
  };
  return (
    <SafeAreaView testID="onboarding-intro" style={styles.introSafe} edges={["top", "bottom"]}>
      <View style={styles.introTopRow}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={workflow.openLogin}>
          <Text style={styles.introSignIn}>{t("onboarding.existingAccount")}</Text>
        </Pressable>
        <View style={styles.introTopRight}>
          <Text
            accessibilityLabel={`${workflow.introIndex + 1} of ${INTRO_SLIDE_COUNT}`}
            style={styles.introDots}
          >
            {workflow.introIndex + 1}/{INTRO_SLIDE_COUNT}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={workflow.skipIntro}>
            <Text style={styles.introSkip}>{t("onboarding.skip")}</Text>
          </Pressable>
        </View>
      </View>
      <Animated.View
        key={`intro-${workflow.introIndex}`}
        entering={FadeInDown.duration(320)}
        style={styles.introSlide}
      >
        <Animated.View
          style={[styles.introVisualWrap, motion.visual]}
          entering={FadeInUp.duration(360)}
        >
          <Animated.Image
            key={`intro-visual-${workflow.introIndex}`}
            source={slide.image}
            style={styles.introVisualImage}
            resizeMode="cover"
            fadeDuration={0}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(180)}
          />
          {workflow.introIndex < slides.length - 1 ? (
            <Image
              source={slides[workflow.introIndex + 1].image}
              style={styles.introHiddenPreload}
              fadeDuration={0}
            />
          ) : null}
        </Animated.View>
        <Animated.View style={[styles.introCopyWrap, motion.copy]}>
          <Text style={styles.introHeroTitle}>{slide.title}</Text>
          <Text style={styles.introHeroBody}>{slide.body}</Text>
        </Animated.View>
      </Animated.View>
      <View style={styles.introBottom}>
        <IntroPagination count={slides.length} activeIndex={workflow.introIndex} />
        <PrimaryButton
          label={
            workflow.introIndex === slides.length - 1
              ? t("onboarding.continue")
              : t("onboarding.next")
          }
          onPress={continueIntro}
        />
      </View>
    </SafeAreaView>
  );
}

function IntroPagination({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.introPaginationRow}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`intro-dot-${index}`}
          style={[styles.introPageDot, index === activeIndex && styles.introPageDotActive]}
        />
      ))}
    </View>
  );
}

function useIntroMotion(introIndex: number) {
  const floatY = useSharedValue(0);
  const parallaxX = useSharedValue(0);
  const visual = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { translateX: parallaxX.value }],
  }));
  const copy = useAnimatedStyle(() => ({
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
    parallaxX.value = 14;
    parallaxX.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [introIndex, parallaxX]);

  return { visual, copy };
}
