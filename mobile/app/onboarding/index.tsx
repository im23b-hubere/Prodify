import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ONBOARDING_COMPLETE_KEY, PENDING_WEEKLY_GOAL_KEY } from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { savePendingWeeklyGoal } from "../../lib/onboardingGoalSync";

const GOALS = [3, 5, 7, 10, 14] as const;
const ONBOARDING_VISUALS = [
  require("../../assets/onboarding/slide-2.png"),
  require("../../assets/onboarding/slide-1.png"),
  require("../../assets/onboarding/slide-3.png"),
] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const floatY = useSharedValue(0);
  const parallaxX = useSharedValue(0);

  const visualFloat = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { translateX: parallaxX.value }],
  }));

  const copyParallax = useAnimatedStyle(() => ({
    transform: [{ translateX: -parallaxX.value * 0.6 }],
  }));

  const slides = useMemo(
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
  const dailyTarget = useMemo(() => Math.max(1, Math.round((goal / 7) * 10) / 10), [goal]);
  const dailyTargetDisplay = useMemo(
    () => (Number.isInteger(dailyTarget) ? String(dailyTarget) : dailyTarget.toFixed(1)),
    [dailyTarget],
  );
  const dailyTargetUnit = useMemo(
    () => (dailyTarget === 1 ? "session" : "sessions"),
    [dailyTarget],
  );

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
  }, [parallaxX, step]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      try {
        await savePendingWeeklyGoal(goal);
      } catch {
        /* continue; goal can still be selected in-app later */
      }
      if (token) {
        try {
          await apiJson("/goals/set", {
            token,
            method: "POST",
            body: { goal_type: "weekly_sessions", target_value: goal },
          });
          await AsyncStorage.removeItem(PENDING_WEEKLY_GOAL_KEY).catch(() => undefined);
        } catch {
          /* goal sync is best-effort */
        }
      }
      try {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
      } catch {
        /* Expo Go / mismatched native module: still continue to app */
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({ pathname: "/paywall", params: { source: "onboarding" } });
    } finally {
      setBusy(false);
    }
  }, [goal, router, token]);

  const requestNotif = useCallback(async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
      await finish();
    } finally {
      setBusy(false);
    }
  }, [finish]);

  if (step < 3) {
    const s = slides[step];
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              setStep(3);
            }}
          >
            <Text style={styles.skip}>{t("onboarding.skip")}</Text>
          </Pressable>
          <Text style={styles.dots}>
            {step + 1}/{slides.length}
          </Text>
        </View>
        <Animated.View
          key={`hero-${step}`}
          entering={FadeInDown.duration(320)}
          style={styles.slide}
        >
          <Animated.View style={[styles.visualWrap, visualFloat]} entering={FadeInUp.duration(360)}>
            <Animated.Image
              key={`visual-${step}`}
              source={s.image}
              style={styles.visualImage}
              resizeMode="cover"
              fadeDuration={0}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(180)}
            />
            {step < slides.length - 1 ? (
              <Image
                source={slides[step + 1].image}
                style={styles.hiddenPreloadImage}
                fadeDuration={0}
              />
            ) : null}
          </Animated.View>
          <Animated.View style={[styles.copyWrap, copyParallax]}>
            <Text style={styles.heroTitle}>{s.title}</Text>
            <Text style={styles.heroBody}>{s.body}</Text>
          </Animated.View>
        </Animated.View>
        <View style={styles.bottomStack}>
          <View style={styles.paginationRow}>
            {slides.map((_, idx) => (
              <View
                key={`dot-${idx}`}
                style={[styles.pageDot, idx === step && styles.pageDotActive]}
              />
            ))}
          </View>
          <PrimaryButton
            label={step === slides.length - 1 ? t("onboarding.continue") : t("onboarding.next")}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setStep((x) => x + 1);
            }}
          />
          <View style={styles.legalRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.footerPrivacy")}
              onPress={() => router.push("/legal/privacy" as never)}
              style={styles.legalFooter}
            >
              <Text style={styles.legalFooterTxt}>{t("onboarding.footerPrivacy")}</Text>
            </Pressable>
            <Text style={styles.legalDivider}>·</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("legal.linksTerms")}
              onPress={() => router.push("/legal/terms" as never)}
              style={styles.legalFooter}
            >
              <Text style={styles.legalFooterTxt}>{t("legal.linksTerms")}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.goalStepLabel}>{t("onboarding.goal.stepLabel")}</Text>
          <Text style={styles.heroTitle}>{t("onboarding.goal.title")}</Text>
          <Text style={styles.heroBody}>{t("onboarding.goal.body")}</Text>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => (
              <Pressable
                key={g}
                style={[styles.goalCard, goal === g && styles.goalCardOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setGoal(g);
                }}
              >
                <Text style={[styles.goalCardValue, goal === g && styles.goalCardValueOn]}>
                  {g}
                </Text>
                <Text style={[styles.goalCardLabel, goal === g && styles.goalCardLabelOn]}>
                  {t("onboarding.goal.sessionsPerWeek")}
                </Text>
                <Text style={[styles.goalCardHint, goal === g && styles.goalCardHintOn]}>
                  {g <= 4
                    ? t("onboarding.goal.intensityLight")
                    : g <= 7
                      ? t("onboarding.goal.intensityConsistent")
                      : g <= 10
                        ? t("onboarding.goal.intensityAmbitious")
                        : t("onboarding.goal.intensityPro")}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.goalInfoCard}>
            <Text style={styles.goalInfoTitle}>{t("onboarding.goal.previewTitle", { goal })}</Text>
            <Text style={styles.goalInfoBody}>
              {t("onboarding.goal.previewBody", {
                daily: dailyTargetDisplay,
                unit: dailyTargetUnit,
              })}
            </Text>
          </View>
          <PrimaryButton label={t("onboarding.goal.lockCta")} onPress={() => setStep(4)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.footerPrivacy")}
            onPress={() => router.push("/legal/privacy" as never)}
            style={styles.legalFooter}
          >
            <Text style={styles.legalFooterTxt}>{t("onboarding.footerPrivacy")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.linksTerms")}
            onPress={() => router.push("/legal/terms" as never)}
            style={styles.legalFooter}
          >
            <Text style={styles.legalFooterTxt}>{t("legal.linksTerms")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.notificationsStepWrap}>
        <View style={styles.notificationsTopCopy}>
          <Text style={styles.heroTitle}>
            {t("onboarding.notifications.titlePrefix")}{" "}
            <Text style={styles.loopAccent}>{t("onboarding.notifications.titleLoop")}</Text>
          </Text>
          <Text style={styles.heroBody}>{t("onboarding.notifications.body")}</Text>
          <View style={styles.notificationsVisualCard}>
            <Text style={styles.notificationsVisualTitle}>
              {t("onboarding.notifications.visualTitle")}
            </Text>
            <View style={styles.notificationsBenefitList}>
              <Text style={styles.notificationsBenefitText}>
                {t("onboarding.notifications.benefit1")}
              </Text>
              <Text style={styles.notificationsBenefitText}>
                {t("onboarding.notifications.benefit2")}
              </Text>
              <Text style={styles.notificationsBenefitText}>
                {t("onboarding.notifications.benefit3")}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <PrimaryButton
        label={t("onboarding.notifications.enable")}
        onPress={requestNotif}
        loading={busy}
      />
      <Pressable style={styles.secondaryBtn} onPress={finish} disabled={busy}>
        <Text style={styles.secondaryTxt}>{t("onboarding.notifications.notNow")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("onboarding.footerPrivacy")}
        onPress={() => router.push("/legal/privacy" as never)}
        style={styles.legalFooter}
      >
        <Text style={styles.legalFooterTxt}>{t("onboarding.footerPrivacy")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("legal.linksTerms")}
        onPress={() => router.push("/legal/terms" as never)}
        style={styles.legalFooter}
      >
        <Text style={styles.legalFooterTxt}>{t("legal.linksTerms")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "flex-start",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skip: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  dots: { color: colors.textSecondary, ...typography.caption },
  slide: { flex: 1, justifyContent: "flex-start", gap: spacing.sm, paddingTop: spacing.sm },
  visualWrap: {
    alignSelf: "center",
    width: "96%",
    maxWidth: 380,
    height: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  visualImage: {
    width: "100%",
    height: "100%",
  },
  hiddenPreloadImage: {
    width: 1,
    height: 1,
    opacity: 0,
    position: "absolute",
  },
  copyWrap: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 26,
    lineHeight: 32,
  },
  heroBody: { color: colors.textSecondary, ...typography.body, lineHeight: 20 },
  bottomStack: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginBottom: 2,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  pageDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },
  goalStepLabel: {
    alignSelf: "flex-start",
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.5)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(162,89,255,0.14)",
  },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  goalCard: {
    width: "48%",
    minHeight: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  goalCardOn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.14)" },
  goalCardValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 26,
    lineHeight: 30,
  },
  goalCardValueOn: { color: colors.primary },
  goalCardLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  goalCardLabelOn: { color: colors.textPrimary },
  goalCardHint: { color: colors.textSecondary, ...typography.caption },
  goalCardHintOn: { color: colors.secondary, fontFamily: fontFamily.bodyBold },
  goalInfoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: spacing.md,
    gap: 4,
  },
  goalInfoTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  goalInfoBody: { color: colors.textSecondary, ...typography.caption },
  secondaryBtn: { alignItems: "center", paddingVertical: spacing.md },
  secondaryTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  notificationsStepWrap: {
    flex: 1,
    justifyContent: "flex-start",
    gap: spacing.md,
  },
  notificationsTopCopy: {
    gap: spacing.sm,
  },
  loopAccent: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
  },
  notificationsVisualCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: spacing.md,
    gap: spacing.xs,
    alignSelf: "stretch",
  },
  notificationsVisualTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  notificationsBenefitList: {
    gap: 4,
  },
  notificationsBenefitText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  legalDivider: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  legalFooter: { alignItems: "center", paddingVertical: 2 },
  legalFooterTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    textDecorationLine: "underline",
  },
});
