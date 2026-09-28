import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Clock, Play, Shield } from "lucide-react-native";
import { memo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import { ActiveSessionTimerBlock } from "../../features/dashboard/components/ActiveSessionTimerBlock";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";
import { AppFlame } from "../icons/ProdifyGlyphs";
import { RankArt } from "../progression/RankArt";
import { PrimaryButton } from "../ui/PrimaryButton";
import { WeeklyQuestCard } from "../studio/WeeklyQuestCard";
import { METRIC_VALUE_HEIGHT, styles } from "./DashboardStudioHud.styles";
import { DashboardWeekDots } from "./DashboardWeekDots";

type Props = {
  t: TFunction;
  activeResolved: boolean;
  active: SessionDto | null;
  stopBusy: boolean;
  onQuickStart: () => void;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  hasWeeklyGoal: boolean;
  weekSessionsCount: number;
  weeklyGoalTarget: number | null;
  savedWeeklyGoalTarget?: number | null;
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
  onOpenSessionHistory: () => void;
  onOpenRank: () => void;
  onOpenStats: () => void;
};

export const DashboardStudioHud = memo(function DashboardStudioHud(props: Props) {
  return (
    <View style={styles.stack} testID="dashboard-studio-hud">
      <SessionAction props={props} />
      <View style={styles.weekPanel}>
        <WeeklyGoalBlock props={props} />
        {props.streakOverview ? (
          <DashboardWeekDots
            overview={props.streakOverview}
            onOpenStats={props.onOpenStats}
            t={props.t}
          />
        ) : null}
        <View style={styles.panelDivider} />
        <DashboardStats props={props} />
        <FreezeAction props={props} />
      </View>
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
      savedWeeklyGoalTarget={props.savedWeeklyGoalTarget}
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
  return (
    <View style={styles.actionWrap} testID="dashboard-start-session">
      <PrimaryButton
        label={props.t("dashboard.startSession")}
        accessibilityLabel={props.t("sessionStarter.title")}
        icon={<Play color="#ffffff" fill="#ffffff" size={16} />}
        onPress={props.onQuickStart}
      />
    </View>
  );
}

function DashboardStats({ props }: { props: Props }) {
  const streaking = props.streakCount > 0;
  return (
    <View style={styles.metricsRow}>
      <MetricItem
        label={props.t("sessionComplete.statStreakLabel")}
        value={String(props.streakCount)}
        icon={
          streaking ? (
            <AppFlame size={16} />
          ) : (
            <AppFlame size={16} color={colors.textSecondary} filled={false} />
          )
        }
        accent={streaking}
        onPress={props.onOpenStreakHistory}
        accessibilityLabel={props.t("streakHero.historyA11y")}
      />
      <View style={styles.metricDivider} />
      <MetricItem
        label={props.t("dashboard.studioTodayLabel")}
        value={props.t("dashboard.studioTodayValue", {
          sessions: props.todaySessions,
          minutes: props.todayMinutes,
        })}
        icon={<Clock color={colors.textSecondary} size={15} />}
        onPress={props.onOpenSessionHistory}
        accessibilityLabel={props.t("dashboard.todayStatA11y")}
      />
      {props.level != null ? (
        <>
          <View style={styles.metricDivider} />
          {/* The medallion is the value here; the level number moves into the label. */}
          <MetricItem
            label={props.t("progression.xpHudLevelShort", { level: props.level })}
            hero={
              <View style={styles.metricHero}>
                <RankArt level={props.level} size={METRIC_VALUE_HEIGHT} />
              </View>
            }
            onPress={props.onOpenRank}
            accessibilityLabel={props.t("dashboard.levelStatA11y")}
          />
        </>
      ) : null}
    </View>
  );
}

type MetricItemProps = {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
} & (
  | { value: string; icon: ReactNode; accent?: boolean; hero?: never }
  | { hero: ReactNode; value?: never; icon?: never; accent?: never }
);

function MetricItem({
  label,
  value,
  icon,
  accent = false,
  hero,
  onPress,
  accessibilityLabel,
}: MetricItemProps) {
  const content = (
    <>
      {hero ?? (
        <View style={styles.metricValueRow}>
          {icon}
          <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
        </View>
      )}
      <Text style={styles.metricLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.metricItem}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.metricItem, pressed && styles.metricItemPressed]}
    >
      {content}
    </Pressable>
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
      <Shield color={overview.can_use_freeze ? colors.primary : colors.textSecondary} size={16} />
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
