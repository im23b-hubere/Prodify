import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
  type SharedValue,
} from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import type { OnboardingWorkflow } from "../hooks/useOnboardingWorkflow";

const TASKS = [
  "onboarding.quiz.building.steps.genre",
  "onboarding.quiz.building.steps.weeklyGoal",
  "onboarding.quiz.building.steps.skillTree",
  "onboarding.quiz.building.steps.ranks",
] as const;
/** Each task "renders" for this long; the bar fills across all of them. */
const TASK_MS = 1100;
const RENDER_MS = TASKS.length * TASK_MS;
/** How long "All set" stays up before the workflow moves on. */
const SETTLE_MS = 900;
const BAR_COUNT = 4;
const METER_HEIGHT = 26;

/** One level-meter bar in the logo tile, bouncing at its own pace while the profile renders. */
function MeterBar({ index, done }: { index: number; done: boolean }) {
  const level = useSharedValue(0.35);

  useEffect(() => {
    if (done) {
      level.set(withTiming(0, { duration: 220 }));
      return;
    }
    const pace = 360 + index * 90;
    level.set(
      withRepeat(
        withSequence(
          withTiming(0.95 - index * 0.08, { duration: pace, easing: Easing.out(Easing.quad) }),
          withTiming(0.3 + (index % 2) * 0.15, { duration: pace, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [done, index, level]);

  const barStyle = useAnimatedStyle(() => ({ height: Math.max(3, level.get() * METER_HEIGHT) }));
  return <Animated.View style={[styles.meterBar, barStyle]} />;
}

function RenderBar({ progress }: { progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View style={styles.renderTrack}>
      <Animated.View style={[styles.renderFill, fillStyle]}>
        <LinearGradient
          colors={[colors.primary, "#ff7a3d"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function TaskRow({ label, state }: { label: string; state: "waiting" | "running" | "done" }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (state !== "running") return;
    pulse.set(withRepeat(withTiming(0.35, { duration: 420 }), -1, true));
  }, [pulse, state]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={styles.task}>
      <View
        style={[
          styles.taskMark,
          state === "running" && styles.taskMarkRunning,
          state === "done" && styles.taskMarkDone,
        ]}
      >
        {state === "done" ? (
          <Animated.View entering={ZoomIn.duration(180)}>
            <Check size={13} color={colors.textPrimary} strokeWidth={3} />
          </Animated.View>
        ) : null}
        {state === "running" ? <Animated.View style={[styles.taskPulse, pulseStyle]} /> : null}
      </View>
      <Text
        style={[
          styles.taskLabel,
          state === "running" && styles.taskLabelRunning,
          state === "done" && styles.taskLabelDone,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * After the last survey answer the profile "renders" like a bounce: a level meter in the logo
 * tile, the three set-up tasks ticking off one by one and a progress bar filling underneath.
 * The answers save meanwhile; once it's done the workflow moves on (paywall, sign-up or app).
 */
export function OnboardingProfileBuild({ workflow }: { workflow: OnboardingWorkflow }) {
  const { t } = useTranslation();
  const [finished, setFinished] = useState(0);
  const done = finished >= TASKS.length;
  const progress = useSharedValue(0);
  const { leaveBuiltProfile } = workflow;
  const [headlineLead, headlineTail] = t("onboarding.quiz.building.headline").split("{brand}");

  useEffect(() => {
    progress.set(withTiming(1, { duration: RENDER_MS, easing: Easing.inOut(Easing.quad) }));
    const timers = TASKS.map((_, index) =>
      setTimeout(
        () => {
          setFinished(index + 1);
          const feedback =
            index === TASKS.length - 1
              ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          feedback.catch(() => undefined);
        },
        (index + 1) * TASK_MS,
      ),
    );
    timers.push(setTimeout(() => void leaveBuiltProfile(), RENDER_MS + SETTLE_MS));
    return () => timers.forEach(clearTimeout);
    // Plays through once, from mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View testID="onboarding-building" style={styles.container}>
      <View style={styles.tile}>
        <LinearGradient
          colors={["#ff6a2b", colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {done ? (
          <Animated.View entering={ZoomIn.duration(240)}>
            <Check size={30} color={colors.textPrimary} strokeWidth={3} />
          </Animated.View>
        ) : (
          <View style={styles.meter}>
            {Array.from({ length: BAR_COUNT }, (_, index) => (
              <MeterBar key={index} index={index} done={done} />
            ))}
          </View>
        )}
      </View>

      <Text style={styles.headline}>
        {headlineLead}
        <Text style={styles.brand}>{t("brand")}</Text>
        {headlineTail}
      </Text>

      <Animated.View entering={FadeInUp.duration(320).delay(120)} style={styles.panel}>
        {TASKS.map((key, index) => (
          <TaskRow
            key={key}
            label={t(key)}
            state={index < finished ? "done" : index === finished ? "running" : "waiting"}
          />
        ))}
        <RenderBar progress={progress} />
      </Animated.View>

      <View style={styles.doneSlot}>
        {done ? (
          <Animated.Text entering={FadeIn.duration(220)} style={styles.doneText}>
            {t("onboarding.quiz.building.done")}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  meter: {
    height: METER_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  meterBar: {
    width: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textPrimary,
  },
  headline: {
    fontFamily: fontFamily.heading,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.textPrimary,
    textAlign: "center",
  },
  brand: {
    color: colors.primary,
  },
  panel: {
    alignSelf: "stretch",
    marginTop: 28,
    padding: 18,
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  taskMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
  },
  taskMarkRunning: {
    borderColor: colors.primary,
  },
  taskMarkDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  taskPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  taskLabel: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: "#5a5a5a",
  },
  taskLabelRunning: {
    color: colors.textPrimary,
  },
  taskLabelDone: {
    color: colors.textSecondary,
  },
  renderTrack: {
    height: 6,
    marginTop: 4,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#222222",
  },
  renderFill: {
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  doneSlot: {
    height: 24,
    marginTop: 18,
    justifyContent: "center",
  },
  doneText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
