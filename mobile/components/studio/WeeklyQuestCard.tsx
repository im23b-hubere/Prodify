import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import { styles } from "./WeeklyQuestCard.styles";
import { weeklyQuestPresentation } from "./weeklyQuestPresentation";

const GOAL_CHIPS = [3, 5, 7] as const;

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
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t("dashboard.weeklyGoalTitle")}</Text>
          <Text style={styles.remainingText}>
            {remaining === 0
              ? t("dashboard.weeklyGoalComplete")
              : t("dashboard.weeklyGoalRemaining", { count: remaining })}
          </Text>
        </View>
        <Text style={styles.progressNumbers}>
          {t("dashboard.weeklyGoalProgressSimple", {
            current: weekSessionsCount,
            target: weeklyGoalTarget,
          })}
        </Text>
      </Pressable>
      <View style={styles.goalProgressTrack}>
        <View style={[styles.goalProgressFill, { width: `${progress}%` }]} />
      </View>
      {editing && onChangeTarget ? (
        <GoalChoices t={t} target={weeklyGoalTarget} busy={busy} onSelect={saveTarget} />
      ) : null}
    </View>
  );
}

export const WeeklyQuestCard = memo(function WeeklyQuestCard(props: Props) {
  if (props.mode === "setup") return <WeeklyQuestSetup {...props} />;
  return <WeeklyQuestProgress {...props} />;
});
