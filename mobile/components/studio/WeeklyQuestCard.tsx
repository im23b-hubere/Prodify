import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

const GOAL_CHIPS = [3, 5, 7] as const;

type QuestStatus = "goalComplete" | "ahead" | "onTrack" | "atRisk" | "offTrack";

function resolveQuestStatus(
  feedback: SessionFeedbackComputed,
  paceForecast: ForecastComputed | null,
): QuestStatus {
  if (feedback.remainingSessionsToGoal === 0) return "goalComplete";
  if (paceForecast?.forecastStatus === "ahead") return "ahead";
  if (paceForecast?.forecastStatus === "at_risk" || paceForecast?.forecastStatus === "will_miss") {
    return "atRisk";
  }
  if (feedback.newStatus === "off_track") return "offTrack";
  return "onTrack";
}

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

export const WeeklyQuestCard = memo(function WeeklyQuestCard(props: Props) {
  const [editing, setEditing] = useState(false);

  if (props.mode === "setup") {
    const { t, busy, onSave, testID = "dashboard-quest-setup" } = props;
    return (
      <View style={styles.wrap} testID={testID}>
        <Text style={styles.setupTitle}>{t("dashboard.weeklyGoalNudgeTitle")}</Text>
        <Text style={styles.setupHint}>{t("dashboard.weeklyGoalInlineHint")}</Text>
        <View style={styles.chipRow}>
          {GOAL_CHIPS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.weeklyGoalChipA11y", { count: value })}
              disabled={busy}
              style={({ pressed }) => [
                styles.chip,
                pressed && !busy && styles.chipPressed,
                busy && styles.chipDisabled,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                void onSave(value);
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.chipText}>{value}</Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const {
    t,
    feedback,
    weekSessionsCount,
    weeklyGoalTarget,
    paceForecast,
    busy,
    onChangeTarget,
    testID = "dashboard-quest-progress",
  } = props;
  const progressPct = paceForecast?.currentProgressPercent ?? feedback.progressPercent ?? 0;
  const questStatus = resolveQuestStatus(feedback, paceForecast);

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("sessionComplete.weekQuestTitle")}</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusChip, styles[`chip_${questStatus}`]]}>
            <Text style={styles.statusChipText}>
              {t(`sessionComplete.questStatus.${questStatus}`)}
            </Text>
          </View>
          {onChangeTarget ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                setEditing((value) => !value);
              }}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.editBtnText}>
                {editing ? t("dashboard.weeklyGoalDone") : t("dashboard.weeklyGoalEdit")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.progressNumbers}>
        {t("sessionComplete.weekProgress", {
          current: weekSessionsCount,
          target: weeklyGoalTarget,
        })}
      </Text>
      <View style={styles.goalProgressTrack}>
        <View style={[styles.goalProgressFill, { width: `${progressPct}%` }]} />
        {paceForecast ? (
          <View
            style={[
              styles.goalProgressMarker,
              { left: `${paceForecast.todayExpectedMarkerPercent}%` },
            ]}
          />
        ) : null}
      </View>

      {editing && onChangeTarget ? (
        <View style={styles.chipRow}>
          {GOAL_CHIPS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              disabled={busy}
              style={({ pressed }) => [
                styles.chip,
                value === weeklyGoalTarget && styles.chipActive,
                pressed && !busy && styles.chipPressed,
                busy && styles.chipDisabled,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                void onChangeTarget(value).then(() => setEditing(false));
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text
                  style={[styles.chipText, value === weeklyGoalTarget && styles.chipTextActive]}
                >
                  {value}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: spacing.sm,
  },
  setupTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  setupHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  statusChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  chip_goalComplete: {
    borderColor: "rgba(0,255,136,0.45)",
    backgroundColor: "rgba(0,255,136,0.12)",
  },
  chip_ahead: {
    borderColor: "rgba(0,255,136,0.35)",
    backgroundColor: "rgba(0,255,136,0.08)",
  },
  chip_onTrack: {
    borderColor: "rgba(162,89,255,0.4)",
    backgroundColor: "rgba(162,89,255,0.12)",
  },
  chip_atRisk: {
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  chip_offTrack: {
    borderColor: "rgba(255,68,68,0.4)",
    backgroundColor: "rgba(255,68,68,0.1)",
  },
  progressNumbers: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  goalProgressTrack: {
    width: "100%",
    height: 10,
    borderRadius: radii.round,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  goalProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  goalProgressMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: "#ffffff",
    opacity: 0.85,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipDisabled: {
    opacity: 0.6,
  },
  chipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  chipTextActive: {
    color: colors.primary,
  },
  editBtn: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  editBtnText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
