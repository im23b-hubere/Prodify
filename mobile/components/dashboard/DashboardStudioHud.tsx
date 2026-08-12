import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Shield } from "lucide-react-native";
import type { TFunction } from "i18next";
import { memo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ActiveSessionTimerBlock } from "../../features/dashboard/components/ActiveSessionTimerBlock";
import { WeeklyQuestCard } from "../studio/WeeklyQuestCard";
import { StatTile } from "../ui/StatTile";
import { colors } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";
import { DashboardWeekDots } from "./DashboardWeekDots";
import { styles } from "./DashboardStudioHud.styles";

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
        <DashboardWeekDots overview={streakOverview} onOpenHistory={onOpenStreakHistory} t={t} />
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
