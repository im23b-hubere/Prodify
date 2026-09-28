import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import { styles } from "./WeeklyQuestCard.styles";
import { weeklyQuestPresentation } from "./weeklyQuestPresentation";

const GOAL_CHIPS = [3, 5, 7] as const;
const RING_SIZE = 58;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type SetupProps = {
  mode: "setup";
  t: TFunction;
  busy?: boolean;
  onSave: (target: number) => Promise<void>;
  testID?: string;
};

type ProgressProps = {
  mode: "progress";
  t: TFunction;
  feedback: SessionFeedbackComputed;
  weekSessionsCount: number;
  weeklyGoalTarget: number;
  savedWeeklyGoalTarget?: number | null;
  paceForecast: ForecastComputed | null;
  busy?: boolean;
  onChangeTarget?: (target: number) => Promise<void>;
  testID?: string;
};

type Props = SetupProps | ProgressProps;

function WeeklyQuestSetup({
  t,
  busy,
  onSave,
  testID = "dashboard-quest-setup",
}: Omit<SetupProps, "mode">) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.setupTitle}>{t("dashboard.weeklyGoalNudgeTitle")}</Text>
      <Text style={styles.setupHint}>{t("dashboard.weeklyGoalInlineHint")}</Text>
      <GoalChoices t={t} busy={busy} onSelect={onSave} />
    </View>
  );
}

function GoalChoices({
  t,
  busy,
  target,
  onSelect,
}: {
  t: TFunction;
  busy?: boolean;
  target?: number;
  onSelect: (target: number) => Promise<void>;
}) {
  return (
    <View style={styles.chipRow}>
      {GOAL_CHIPS.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.weeklyGoalChipA11y", { count: value })}
          disabled={busy}
          style={({ pressed }) => [
            styles.chip,
            value === target && styles.chipActive,
            pressed && !busy && styles.chipPressed,
            busy && styles.chipDisabled,
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            void onSelect(value);
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.chipText, value === target && styles.chipTextActive]}>
              {t("dashboard.weeklyGoalChoice", { count: value })}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function WeeklyQuestProgress({
  t,
  feedback,
  weekSessionsCount,
  weeklyGoalTarget,
  savedWeeklyGoalTarget,
  paceForecast,
  busy,
  onChangeTarget,
  testID = "dashboard-quest-progress",
}: Omit<ProgressProps, "mode">) {
  const [editing, setEditing] = useState(false);
  const progress = weeklyQuestPresentation(feedback, paceForecast).progressPercent;
  const remaining = Math.max(
    0,
    feedback.remainingSessionsToGoal ?? weeklyGoalTarget - weekSessionsCount,
  );
  const toggleEditing = () => {
    if (!onChangeTarget) return;
    Haptics.selectionAsync().catch(() => undefined);
    setEditing((value) => !value);
  };
  const saveTarget = async (target: number) => {
    if (!onChangeTarget) return;
    await onChangeTarget(target);
    setEditing(false);
  };
  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        accessibilityRole={onChangeTarget ? "button" : undefined}
        accessibilityLabel={
          onChangeTarget
            ? editing
              ? t("dashboard.weeklyGoalDone")
              : t("dashboard.weeklyGoalEdit")
            : undefined
        }
        disabled={!onChangeTarget}
        onPress={toggleEditing}
        style={({ pressed }) => [styles.headerRow, pressed && styles.headerPressed]}
      >
        <GoalRing
          current={weekSessionsCount}
          target={weeklyGoalTarget}
          progress={progress}
          label={t("dashboard.weeklyGoalProgressSimple", {
            current: weekSessionsCount,
            target: weeklyGoalTarget,
          })}
        />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t("dashboard.weeklyGoalTitle")}</Text>
          <Text style={[styles.remainingText, remaining === 0 && styles.remainingDone]}>
            {remaining === 0
              ? t("dashboard.weeklyGoalComplete")
              : t("dashboard.weeklyGoalRemaining", { count: remaining })}
          </Text>
        </View>
      </Pressable>
      {editing && onChangeTarget ? (
        <GoalChoices
          t={t}
          target={savedWeeklyGoalTarget ?? weeklyGoalTarget}
          busy={busy}
          onSelect={saveTarget}
        />
      ) : null}
    </View>
  );
}

/** Sessions this week against the goal, as a ring with the count in the middle. */
function GoalRing({
  current,
  target,
  progress,
  label,
}: {
  current: number;
  target: number;
  progress: number;
  label: string;
}) {
  const fraction = Math.max(0, Math.min(1, progress / 100));
  return (
    <View style={styles.ring} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {fraction > 0 ? (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.primary}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
            fill="none"
          />
        ) : null}
      </Svg>
      <Text style={styles.ringCount}>
        {current}
        <Text style={styles.ringTarget}>/{target}</Text>
      </Text>
    </View>
  );
}

export const WeeklyQuestCard = memo(function WeeklyQuestCard(props: Props) {
  if (props.mode === "setup") return <WeeklyQuestSetup {...props} />;
  return <WeeklyQuestProgress {...props} />;
});
