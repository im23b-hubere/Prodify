import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import type { OnboardingPresentation } from "../hooks/useOnboardingPresentation";
import type { OnboardingWorkflow } from "../hooks/useOnboardingWorkflow";
import { OnboardingButton } from "./OnboardingButton";
import { OnboardingVideo } from "./OnboardingVideo";

type Slide = OnboardingPresentation["introSlides"][number];

type Props = {
  workflow: OnboardingWorkflow;
  slides: OnboardingPresentation["introSlides"];
};

/** Room between a recording and the text under it. */
const RECORDING_GAP = 18;
const TITLE_LINE = 37;
const BODY_LINE = 23;

/**
 * The title with its key word in Prodify orange. Every title is written as two lines and
 * keeps that height, shrinking a little in longer languages rather than wrapping a third.
 */
function SlideTitle({ slide }: { slide: Slide }) {
  const at = slide.emphasis ? slide.title.indexOf(slide.emphasis) : -1;
  const fit = { numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.75 } as const;
  if (at < 0) {
    return (
      <Text style={styles.title} {...fit}>
        {slide.title}
      </Text>
    );
  }
  return (
    <Text style={styles.title} {...fit}>
      {slide.title.slice(0, at)}
      <Text style={styles.titleAccent}>{slide.emphasis}</Text>
      {slide.title.slice(at + slide.emphasis.length)}
    </Text>
  );
}

/**
 * Three showcase pages you swipe or step through: a looping recording of the app with a
 * headline under it, and the button with the sign-in line at the bottom.
 */
export function OnboardingIntro({ workflow, slides }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const isAutoScrolling = useRef(false);
  const page = workflow.introIndex;
  // Back from the questions you land on the page you left. Read once, so following the
  // live index can't yank the pager mid-swipe.
  const [startOffset] = useState(() => ({ x: page * pageWidth, y: 0 }));
  // Each page's text height, so its recording fills exactly the space above it.
  const [textHeights, setTextHeights] = useState<number[]>([]);
  const isLastPage = page === slides.length - 1;

  const followSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isAutoScrolling.current) return;
    const swipedTo = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (swipedTo !== page) workflow.setIntroIndex(swipedTo);
  };

  const advance = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (isLastPage) {
      workflow.nextIntroSlide();
      return;
    }
    const next = page + 1;
    isAutoScrolling.current = true;
    workflow.setIntroIndex(next);
    pagerRef.current?.scrollTo({ x: next * pageWidth, animated: true });
    setTimeout(() => {
      isAutoScrolling.current = false;
    }, 350);
  };

  const rememberTextHeight = (index: number, height: number) =>
    setTextHeights((current) => {
      if (current[index] === height) return current;
      const next = [...current];
      next[index] = height;
      return next;
    });

  return (
    <SafeAreaView testID="onboarding-intro" style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        {/* Development builds only: in a release it would let anyone skip onboarding. */}
        {__DEV__ && page === 0 ? (
          <Pressable
            accessibilityRole="button"
            style={styles.devSkip}
            onPress={() => router.replace("/(tabs)/dashboard")}
            hitSlop={12}
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- dev-only control */}
            <Text style={styles.devSkipText}>Skip to home</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={pagerRef}
        style={styles.pager}
        contentOffset={startOffset}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={followSwipe}
        scrollEventThrottle={16}
      >
        {slides.map((slide, index) => (
          <View key={slide.title} style={[styles.page, { width: pageWidth }]}>
            {textHeights[index] ? (
              <View style={[styles.recording, { bottom: textHeights[index] + RECORDING_GAP }]}>
                <OnboardingVideo source={slide.video} active={index === page} />
              </View>
            ) : null}
            <Animated.View
              entering={FadeIn.duration(400).delay(150)}
              style={styles.text}
              onLayout={(event) => rememberTextHeight(index, event.nativeEvent.layout.height)}
            >
              <SlideTitle slide={slide} />
              <Text
                style={styles.body}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {slide.body}
              </Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton
          label={isLastPage ? t("onboarding.continue") : t("onboarding.next")}
          onPress={advance}
        />
        {workflow.signedIn ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.existingAccount")}
            onPress={workflow.openLogin}
            hitSlop={8}
            style={styles.signIn}
          >
            <Text style={styles.signInPrompt}>
              {t("onboarding.haveAccount")}{" "}
              <Text style={styles.signInLink}>{t("onboarding.existingAccount")}</Text>
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    minHeight: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  devSkip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },
  devSkipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    overflow: "hidden",
  },
  recording: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
  },
  text: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 8,
  },
  // Exactly two lines each, so every page has the same text block and recording size.
  title: {
    height: TITLE_LINE * 2,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 31,
    lineHeight: TITLE_LINE,
    letterSpacing: -1,
  },
  titleAccent: {
    color: colors.primary,
  },
  body: {
    height: BODY_LINE * 2,
    marginTop: 10,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: BODY_LINE,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  signIn: {
    alignSelf: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  signInPrompt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  signInLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
  },
});
