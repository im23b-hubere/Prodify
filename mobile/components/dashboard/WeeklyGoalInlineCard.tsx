import * as Haptics from "expo-haptics";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppCard } from "../ui/AppCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";

const GOAL_CHIPS = [3, 5, 7] as const;

type SetupProps = {
  mode: "setup";
  busy?: boolean;
  onSave: (target: number) => Promise<void>;
};

type ProgressProps = {
  mode: "progress";
  current: number;
  target: number;
  busy?: boolean;
  onChangeTarget?: (target: number) => Promise<void>;
};

type Props = SetupProps | ProgressProps;

export const WeeklyGoalInlineCard = memo(function WeeklyGoalInlineCard(props: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (props.mode === "setup") {
    const { busy, onSave } = props;
    return (
      <View testID="weekly-goal-inline-setup">
        <AppCard style={styles.card}>
          <Text style={styles.title}>{t("dashboard.weeklyGoalNudgeTitle")}</Text>
          <Text style={styles.hint}>{t("dashboard.weeklyGoalInlineHint")}</Text>
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
        </AppCard>
      </View>
    );
  }

  const { current, target, busy, onChangeTarget } = props;
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  return (
    <View testID="weekly-goal-inline-progress">
      <AppCard style={styles.card}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            {t("dashboard.weeklyGoalProgress", { current, target })}
          </Text>
          {onChangeTarget ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                setEditing((v) => !v);
              }}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.editBtnText}>
                {editing ? t("dashboard.weeklyGoalDone") : t("dashboard.weeklyGoalEdit")}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
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
                  value === target && styles.chipActive,
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
                  <Text style={[styles.chipText, value === target && styles.chipTextActive]}>
                    {value}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}
      </AppCard>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: ui.compactGap,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
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
    backgroundColor: colors.surface,
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
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  progressLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    flex: 1,
  },
  track: {
    height: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  editBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  editBtnText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
