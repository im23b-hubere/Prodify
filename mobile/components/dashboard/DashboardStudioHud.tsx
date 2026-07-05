import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Shield } from "lucide-react-native";
import type { TFunction } from "i18next";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ActiveSessionTimerBlock } from "../../features/dashboard/components/ActiveSessionTimerBlock";
import { WeeklyQuestCard } from "../studio/WeeklyQuestCard";
import { StatTile } from "../ui/StatTile";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";

type WeekDotKind = "none" | "session" | "freeze";

type Props = {
  t: TFunction;
  loading?: boolean;
  active: SessionDto | null;
  stopBusy: boolean;
  onQuickStart: () => void;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  hasWeeklyGoal: boolean;
  weekSessionsCount: number;
  weeklyGoalTarget: number | null;
  goalSaving: boolean;
  onSaveWeeklyGoal: (target: number) => Promise<void>;
  feedback: SessionFeedbackComputed;
  paceForecast: ForecastComputed | null;
  streakOverview: StreakOverviewDto | null;
  streakCount: number;
  todaySessions: number;
  todayMinutes: number;
  level: number | null;
  statusLine: string | null;
  freezeBusy: boolean;
  onUseFreeze: () => void;
  onFreezeUnavailable: () => void;
  onOpenStreakHistory: () => void;
};

function WeekDots({
  overview,
  onOpenHistory,
  t,
}: {
  overview: StreakOverviewDto;
  onOpenHistory: () => void;
  t: TFunction;
}) {
  const kinds = (overview.last_7_day_states ?? []) as WeekDotKind[];
  const labels = overview.last_7_day_labels ?? [];
  if (kinds.length !== 7 || labels.length !== 7) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("streakHero.historyA11y")}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onOpenHistory();
      }}
      style={({ pressed }) => [styles.weekRow, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.weekDots}>
        {labels.map((label, index) => {
          const kind = kinds[index] ?? "none";
          const isToday = index === 6;
          return (
            <View key={`${label}-${index}`} style={styles.dayColumn}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {label.slice(0, 1)}
              </Text>
              <View
                style={[
                  styles.dayDot,
                  kind === "session" && styles.dayDotSession,
                  kind === "freeze" && styles.dayDotFreeze,
                  isToday && styles.dayDotToday,
                ]}
              />
            </View>
          );
        })}
      </View>
      <ChevronRight color={colors.secondary} size={18} />
    </Pressable>
  );
}

export const DashboardStudioHud = memo(function DashboardStudioHud({
  t,
  loading = false,
  active,
  stopBusy,
  onQuickStart,
  onOpenFullscreen,
  onConfirmStop,
  hasWeeklyGoal,
  weekSessionsCount,
  weeklyGoalTarget,
  goalSaving,
  onSaveWeeklyGoal,
  feedback,
  paceForecast,
  streakOverview,
  streakCount,
  todaySessions,
  todayMinutes,
  level,
  statusLine,
  freezeBusy,
  onUseFreeze,
  onFreezeUnavailable,
  onOpenStreakHistory,
}: Props) {
  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0a0a0a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="dashboard-studio-hud"
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!hasWeeklyGoal || weeklyGoalTarget == null ? (
        <WeeklyQuestCard mode="setup" t={t} busy={goalSaving} onSave={onSaveWeeklyGoal} />
      ) : (
        <WeeklyQuestCard
          mode="progress"
          t={t}
          feedback={feedback}
          weekSessionsCount={weekSessionsCount}
          weeklyGoalTarget={weeklyGoalTarget}
          paceForecast={paceForecast}
          busy={goalSaving}
          onChangeTarget={onSaveWeeklyGoal}
        />
      )}

      <View style={styles.actionWrap}>
        {active ? (
          <ActiveSessionTimerBlock
            active={active}
            onOpenFullscreen={onOpenFullscreen}
            onConfirmStop={onConfirmStop}
            stopBusy={stopBusy}
          />
        ) : (
          <View testID="dashboard-start-session">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sessionStarter.title")}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                onQuickStart();
              }}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.startBtnInner}>
                <Text style={styles.startEmoji}>▶</Text>
                <Text style={styles.startTitle}>{t("sessionStarter.title")}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onQuickStart();
              }}
              style={({ pressed }) => [styles.customizeBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.customizeText}>{t("sessionStarter.customize")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.statGrid}>
        <StatTile
          label={t("sessionComplete.statStreakLabel")}
          value={`${streakCount}d`}
          icon={streakCount > 0 ? "flame" : undefined}
          accent={streakCount > 0}
        />
        <StatTile
          label={t("dashboard.studioTodayLabel")}
          value={t("dashboard.studioTodayValue", {
            sessions: todaySessions,
            minutes: todayMinutes,
          })}
        />
        {level != null ? (
          <StatTile label={t("sessionComplete.statLevelLabel")} value={`${level}`} />
        ) : null}
      </View>

      {statusLine ? <Text style={styles.statusLine}>{statusLine}</Text> : null}

      {streakOverview ? (
        <WeekDots overview={streakOverview} onOpenHistory={onOpenStreakHistory} t={t} />
      ) : null}

      {streakOverview?.streak_at_risk ? (
        <Pressable
          style={({ pressed }) => [
            styles.freezeBtn,
            (!streakOverview.can_use_freeze || freezeBusy) && styles.freezeDisabled,
            pressed && streakOverview.can_use_freeze && !freezeBusy && { opacity: 0.9 },
          ]}
          onPress={() => {
            if (!streakOverview.can_use_freeze || freezeBusy) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                () => undefined,
              );
              onFreezeUnavailable();
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
            onUseFreeze();
          }}
        >
          <Shield
            color={streakOverview.can_use_freeze ? colors.secondary : colors.textSecondary}
            size={16}
          />
          <Text style={styles.freezeLabel}>
            {freezeBusy
              ? t("streakHero.freezeActivating")
              : streakOverview.freezes_remaining > 0
                ? t("streakHero.freezeAvailable", { n: streakOverview.freezes_remaining })
                : t("streakHero.freezeNone")}
          </Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  actionWrap: {
    width: "100%",
  },
  startBtn: {
    width: "100%",
  },
  startBtnInner: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  startEmoji: {
    fontSize: 32,
    color: "#fff",
  },
  startTitle: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  customizeBtn: {
    alignItems: "center",
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  customizeText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusLine: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  weekDots: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
  },
  dayLabelToday: {
    color: colors.textPrimary,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDotSession: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,61,0,0.6)",
  },
  dayDotFreeze: {
    backgroundColor: colors.secondary,
    borderColor: "rgba(162,89,255,0.6)",
  },
  dayDotToday: {
    transform: [{ scale: 1.15 }],
  },
  freezeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
    backgroundColor: "rgba(162,89,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  freezeDisabled: {
    opacity: 0.65,
  },
  freezeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
