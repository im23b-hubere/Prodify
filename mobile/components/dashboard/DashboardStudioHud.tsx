import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { Shield } from "lucide-react-native";
import { memo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import { ActiveSessionTimerBlock } from "../../features/dashboard/components/ActiveSessionTimerBlock";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";
import { WeeklyQuestCard } from "../studio/WeeklyQuestCard";
import { styles } from "./DashboardStudioHud.styles";
import { DashboardWeekDots } from "./DashboardWeekDots";

type Props = {
  t: TFunction;
  loading?: boolean;
  activeResolved: boolean;
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
  freezeBusy: boolean;
  onUseFreeze: () => void;
  onFreezeUnavailable: () => void;
  onOpenStreakHistory: () => void;
};

export const DashboardStudioHud = memo(function DashboardStudioHud(props: Props) {
  return (
    <View style={styles.stack} testID="dashboard-studio-hud">
      <LinearGradient
        colors={["#3d1510", "#1a1010", "#0a0a0a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        {props.loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        <SessionAction props={props} />
      </LinearGradient>
      <View style={styles.goalCard}>
        <WeeklyGoalBlock props={props} />
      </View>
      <DashboardStats props={props} />
      {props.streakOverview ? (
        <View style={styles.streakCard}>
          <DashboardWeekDots
            overview={props.streakOverview}
            onOpenHistory={props.onOpenStreakHistory}
            t={props.t}
          />
          <FreezeAction props={props} />
        </View>
      ) : null}
    </View>
  );
});

function WeeklyGoalBlock({ props }: { props: Props }) {
  if (!props.hasWeeklyGoal || props.weeklyGoalTarget == null) {
    return (
      <WeeklyQuestCard
        mode="setup"
        t={props.t}
        busy={props.goalSaving}
        onSave={props.onSaveWeeklyGoal}
      />
    );
  }
  return (
    <WeeklyQuestCard
      mode="progress"
      t={props.t}
      feedback={props.feedback}
      weekSessionsCount={props.weekSessionsCount}
      weeklyGoalTarget={props.weeklyGoalTarget}
      paceForecast={props.paceForecast}
      busy={props.goalSaving}
      onChangeTarget={props.onSaveWeeklyGoal}
    />
  );
}

function SessionAction({ props }: { props: Props }) {
  if (props.active) {
    return (
      <View style={styles.actionWrap}>
        <ActiveSessionTimerBlock
          active={props.active}
          onOpenFullscreen={props.onOpenFullscreen}
          onConfirmStop={props.onConfirmStop}
          stopBusy={props.stopBusy}
        />
      </View>
    );
  }
  if (!props.activeResolved) {
    return (
      <View style={styles.actionWrap} testID="dashboard-start-session-loading">
        <View style={styles.sessionLoadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.sessionLoadingText}>{props.t("dashboard.loadingActiveSession")}</Text>
        </View>
      </View>
    );
  }
  const quickStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    props.onQuickStart();
  };
  const customize = () => {
    Haptics.selectionAsync().catch(() => undefined);
    props.onQuickStart();
  };
  return (
    <View style={styles.actionWrap}>
      <View testID="dashboard-start-session">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.t("sessionStarter.title")}
          accessibilityState={{ disabled: false }}
          onPress={quickStart}
          style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.startBtnInner}>
            <Text style={styles.startEmoji}>▶</Text>
            <Text style={styles.startTitle}>{props.t("sessionStarter.title")}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={customize}
          style={({ pressed }) => [styles.customizeBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.customizeText}>{props.t("sessionStarter.customize")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DashboardStats({ props }: { props: Props }) {
  return (
    <View style={styles.metricsCard}>
      <MetricItem
        label={props.t("sessionComplete.statStreakLabel")}
        value={`${props.streakCount}d`}
      />
      <View style={styles.metricDivider} />
      <MetricItem
        label={props.t("dashboard.studioTodayLabel")}
        value={props.t("dashboard.studioTodayValue", {
          sessions: props.todaySessions,
          minutes: props.todayMinutes,
        })}
      />
      {props.level != null ? (
        <>
          <View style={styles.metricDivider} />
          <MetricItem label={props.t("sessionComplete.statLevelLabel")} value={`${props.level}`} />
        </>
      ) : null}
    </View>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function FreezeAction({ props }: { props: Props }) {
  const overview = props.streakOverview;
  if (!overview?.streak_at_risk) return null;
  const unavailable = !overview.can_use_freeze || props.freezeBusy;
  const activateFreeze = () => {
    if (unavailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      props.onFreezeUnavailable();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    props.onUseFreeze();
  };
  return (
    <Pressable
      style={({ pressed }) => [
        styles.freezeBtn,
        unavailable && styles.freezeDisabled,
        pressed && !unavailable && { opacity: 0.9 },
      ]}
      onPress={activateFreeze}
    >
      <Shield color={overview.can_use_freeze ? colors.secondary : colors.textSecondary} size={16} />
      <Text style={styles.freezeLabel}>{freezeLabel(props.t, overview, props.freezeBusy)}</Text>
    </Pressable>
  );
}

function freezeLabel(t: TFunction, overview: StreakOverviewDto, busy: boolean) {
  if (busy) return t("streakHero.freezeActivating");
  if (overview.freezes_remaining > 0)
    return t("streakHero.freezeAvailable", { n: overview.freezes_remaining });
  return t("streakHero.freezeNone");
}
