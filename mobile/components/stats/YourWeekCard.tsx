import type { TFunction } from "i18next";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";
import { YourWeekGoalEditorModal } from "./YourWeekGoalEditorModal";
import { colors } from "../../constants/theme";
import { yourWeekStyles as styles } from "./yourWeek.styles";
import { WEEKDAY_LETTERS, currentWeekDateKeys, localDateKey } from "../../lib/weekCalendar";
import {
  activeHeatmapDayKeys,
  forecastRiskTranslationKey,
  goalProgressPercent,
  yourWeekNextStep,
  yourWeekStatus,
} from "../../features/stats/yourWeekPresentation";
import {
  useYourWeekGoalEditor,
  WEEKLY_GOAL_CHIPS,
} from "../../features/stats/useYourWeekGoalEditor";
import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
import type { GoalForecastDto } from "../../types/outcomes";

type HeatmapDay = { date: string; seconds: number; intensity: number };

type Props = {
  t: TFunction;
  goal: GoalCurrentDto | null;
  forecast: GoalForecastDto | null;
  commitment: CommitmentDto | null;
  heatmapDays: HeatmapDay[];
  configured: boolean;
  busy: boolean;
  hero?: boolean;
  embedded?: boolean;
  onSaveGoal: (target: number, shareWithFriends: boolean) => Promise<void>;
  onStartSession: () => void;
};

export function YourWeekCard({
  t,
  goal,
  forecast,
  commitment,
  heatmapDays,
  configured,
  busy,
  hero = false,
  embedded = false,
  onSaveGoal,
  onStartSession,
}: Props) {
  const {
    open: editorOpen,
    close: closeEditor,
    openEditor,
    selectedTarget,
    customTarget,
    setCustomTarget,
    selectPreset,
    shareWithFriends,
    setShareWithFriends,
    save: saveFromEditor,
  } = useYourWeekGoalEditor({ goal, commitment, onSaveGoal });

  const weekKeys = useMemo(() => currentWeekDateKeys(), []);
  const activeDayKeys = useMemo(() => activeHeatmapDayKeys(heatmapDays), [heatmapDays]);

  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const status = yourWeekStatus(goal, forecast, configured);
  const progressPct = goalProgressPercent(goal);

  const saveFromSetup = async (target: number) => {
    await onSaveGoal(target, false);
  };

  const primaryLabel =
    status === "setup"
      ? t("stats.yourWeek.setTargetCta")
      : status === "completed"
        ? t("stats.yourWeek.raiseTargetCta")
        : status === "behind"
          ? t("stats.yourWeek.catchUpCta")
          : t("stats.yourWeek.startSessionCta");

  const primaryAction = () => {
    if (status === "setup") {
      openEditor(5);
      return;
    }
    if (status === "completed") {
      openEditor((goal?.target_value ?? 5) + 1);
      return;
    }
    onStartSession();
  };

  const forecastRiskKey = forecastRiskTranslationKey(forecast);

  const nextStepLine = useMemo(() => {
    return yourWeekNextStep(goal, forecast, configured, status, t);
  }, [configured, goal, status, forecast, t]);

  const eyebrowStyle = [
    styles.sectionEyebrow,
    hero && embedded ? styles.sectionEyebrowEmbedded : null,
  ];

  const cardBody = (
    <>
      <Text style={eyebrowStyle}>{t("stats.yourWeek.eyebrow")}</Text>

      {!configured ? (
        <View style={styles.setupWrap}>
          <Text style={[styles.setupTitle, hero && styles.setupTitleHero]}>
            {t("stats.yourWeek.setupTitle")}
          </Text>
          {!hero ? <Text style={styles.setupHint}>{t("stats.yourWeek.setupHint")}</Text> : null}
          <View style={styles.chipRow}>
            {WEEKLY_GOAL_CHIPS.map((n) => (
              <Pressable
                key={n}
                style={({ pressed }) => [
                  styles.chip,
                  hero && styles.chipHero,
                  hero && embedded && styles.chipEmbedded,
                  pressed && styles.chipPressed,
                ]}
                disabled={busy}
                onPress={() => void saveFromSetup(n)}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Text style={styles.chipValue}>{n}</Text>
                    <Text style={styles.chipLabel}>{t("stats.yourWeek.sessionsUnit")}</Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => openEditor(5)} disabled={busy}>
            <Text style={styles.customLink}>{t("stats.yourWeek.customTarget")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.metricRow}>
            <Text style={[styles.bigNumber, hero && styles.bigNumberHero]}>
              {goal?.current_sessions ?? 0}
              <Text style={styles.bigNumberDim}> / {goal?.target_value ?? "—"}</Text>
            </Text>
            <Text style={styles.metricLabel}>{t("stats.yourWeek.sessionsThisWeek")}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              status === "on_track" && styles.statusOnTrack,
              status === "behind" && styles.statusBehind,
              status === "completed" && styles.statusDone,
            ]}
          >
            <Text style={styles.statusText}>
              {status === "completed"
                ? t("stats.yourWeek.statusCompleted")
                : status === "behind"
                  ? t("stats.yourWeek.statusBehind")
                  : t("stats.yourWeek.statusOnTrack")}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          {hero && nextStepLine ? (
            <Text style={styles.nextStep} numberOfLines={2}>
              {nextStepLine}
            </Text>
          ) : null}

          {!hero && forecast && forecastRiskKey ? (
            <Text
              style={[
                styles.forecastLine,
                forecast.risk_level === "on_track" && styles.forecastOnTrack,
                forecast.risk_level === "at_risk" && styles.forecastAtRisk,
                forecast.risk_level === "off_track" && styles.forecastOffTrack,
              ]}
            >
              {t(forecastRiskKey)} ·{" "}
              {t("stats.forecastRemaining", {
                n: forecast.remaining_sessions,
                days: forecast.days_left,
              })}
            </Text>
          ) : null}

          {!hero ? (
            <>
              <Text style={styles.studioLabel}>{t("stats.yourWeek.studioDays")}</Text>
              <View style={styles.dayRow}>
                {weekKeys.map((key, idx) => {
                  const active = activeDayKeys.has(key);
                  return (
                    <View key={key} style={styles.dayCell}>
                      <View
                        style={[
                          styles.dayDot,
                          active && styles.dayDotActive,
                          key === todayKey && styles.dayDotToday,
                        ]}
                      />
                      <Text style={[styles.dayLetter, active && styles.dayLetterActive]}>
                        {WEEKDAY_LETTERS[idx]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {!hero && commitment ? (
            <View style={styles.promiseRow}>
              <Text style={styles.promiseText}>
                {commitment.witness_usernames?.length
                  ? t("stats.yourWeek.sharedWith", {
                      names: commitment.witness_usernames.map((n) => `@${n}`).join(", "),
                    })
                  : t("stats.yourWeek.sharedWithFriends")}
              </Text>
            </View>
          ) : null}

          <PrimaryButton
            label={busy ? t("stats.yourWeek.saving") : primaryLabel}
            onPress={primaryAction}
            disabled={busy}
          />
          {status !== "completed" ? (
            <Pressable onPress={() => openEditor()} disabled={busy} style={styles.editLink}>
              <Text style={styles.editLinkText}>{t("stats.yourWeek.editGoal")}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <>
      <View testID={hero ? "your-week-hero" : undefined}>
        {hero && embedded ? (
          <View style={styles.embeddedShell}>{cardBody}</View>
        ) : (
          <AppCard style={[styles.card, hero ? styles.cardHero : undefined]}>{cardBody}</AppCard>
        )}
      </View>

      <YourWeekGoalEditorModal
        t={t}
        visible={editorOpen}
        busy={busy}
        selectedTarget={selectedTarget}
        customTarget={customTarget}
        shareWithFriends={shareWithFriends}
        onClose={closeEditor}
        onSelectPreset={selectPreset}
        onChangeCustomTarget={setCustomTarget}
        onChangeSharing={setShareWithFriends}
        onSave={saveFromEditor}
      />
    </>
  );
}
