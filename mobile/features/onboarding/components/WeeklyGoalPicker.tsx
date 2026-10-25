import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, withTiming } from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import { WEEKLY_GOALS, sessionsPerWeekday } from "../onboardingConfig";

/** Every column has room for the busiest day (two sessions), so the strip never jumps. */
const MAX_PER_DAY = 2;
const CLIP_HEIGHT = 26;
const CLIP_GAP = 6;
const CLIP_TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };

/** A clip fades in from slightly smaller: enough to notice, no bounce. */
function clipEntering() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.88 }] },
    animations: {
      opacity: withTiming(1, CLIP_TIMING),
      transform: [{ scale: withTiming(1, CLIP_TIMING) }],
    },
  };
}

type Props = {
  value: number;
  onChange: (goal: number) => void;
  /** "About 1 session per day on average." */
  averageLine: string;
};

/**
 * The weekly target as a studio week: the number, how intense that is, and Monday–Sunday
 * with each session as a clip on its day. Picking another target pops clips in and out where
 * they'd land, so the commitment reads at a glance.
 */
export function WeeklyGoalPicker({ value, onChange, averageLine }: Props) {
  const { t } = useTranslation();
  const days = sessionsPerWeekday(value);
  const dayNames = t("dashboard.weekdayShort", { returnObjects: true }) as string[];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.hero}>
          <Animated.Text key={value} entering={FadeInDown.duration(220)} style={styles.number}>
            {value}
          </Animated.Text>
          <Text style={styles.unit}>{t("onboarding.quiz.weeklyGoal.perWeek")}</Text>
        </View>
        <Animated.View key={`level-${value}`} entering={FadeIn.duration(200)} style={styles.level}>
          <Text style={styles.levelText}>{t(`onboarding.quiz.weeklyGoal.levels.${value}`)}</Text>
        </Animated.View>

        <View style={styles.week}>
          {days.map((count, day) => (
            <View key={day} style={styles.day}>
              <View style={styles.slots}>
                {Array.from({ length: MAX_PER_DAY }, (_, slot) =>
                  slot < count ? (
                    <Animated.View
                      key={`clip-${slot}`}
                      entering={clipEntering}
                      exiting={FadeOut.duration(140)}
                      style={styles.clip}
                    >
                      <LinearGradient
                        colors={["#ff5a1f", colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  ) : (
                    <View key={`slot-${slot}`} style={styles.emptySlot} />
                  ),
                )}
              </View>
              <Text style={[styles.dayName, count > 0 && styles.dayNameActive]}>
                {dayNames[day]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.options}>
        {WEEKLY_GOALS.map((goal) => {
          const selected = goal === value;
          return (
            <Pressable
              key={goal}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t("onboarding.quiz.weeklyGoal.optionLabel", { count: goal })}
              onPress={() => {
                if (selected) return;
                void Haptics.selectionAsync().catch(() => undefined);
                onChange(goal);
              }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{goal}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.average}>{averageLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  hero: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  number: {
    fontFamily: fontFamily.heading,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    color: colors.textPrimary,
  },
  unit: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  level: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  levelText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  week: {
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  // Sessions stack up from the bottom, like regions filling a track.
  slots: {
    alignSelf: "stretch",
    height: MAX_PER_DAY * CLIP_HEIGHT + (MAX_PER_DAY - 1) * CLIP_GAP,
    flexDirection: "column-reverse",
    gap: CLIP_GAP,
  },
  clip: {
    height: CLIP_HEIGHT,
    borderRadius: 7,
    overflow: "hidden",
  },
  emptySlot: {
    height: CLIP_HEIGHT,
    borderRadius: 7,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2a2a2a",
  },
  dayName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: "#5a5a5a",
  },
  dayNameActive: {
    color: colors.textSecondary,
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  option: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  optionPressed: {
    transform: [{ scale: 0.94 }],
  },
  optionText: {
    fontFamily: fontFamily.heading,
    fontSize: 19,
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.textPrimary,
  },
  average: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
