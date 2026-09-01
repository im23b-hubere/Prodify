import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../constants/theme";
import type { YourWeekCardModel } from "../../features/stats/useYourWeekCardModel";
import {
  WEEKLY_GOAL_CHIPS,
  type YourWeekGoalEditorState,
} from "../../features/stats/useYourWeekGoalEditor";
import { PrimaryButton } from "../ui/PrimaryButton";
import type { YourWeekCardProps } from "./YourWeekCard";
import { yourWeekStyles as styles } from "./yourWeek.styles";

type SectionProps = {
  props: YourWeekCardProps;
  editor: YourWeekGoalEditorState;
  model: YourWeekCardModel;
};

export function YourWeekSetup({ props, editor }: SectionProps) {
  const { t, hero = false, embedded = false, busy } = props;
  return (
    <View style={styles.setupWrap}>
      <Text style={[styles.setupTitle, hero && styles.setupTitleHero]}>
        {t("stats.yourWeek.setupTitle")}
      </Text>
      {!hero ? <Text style={styles.setupHint}>{t("stats.yourWeek.setupHint")}</Text> : null}
      <View style={styles.chipRow}>
        {WEEKLY_GOAL_CHIPS.map((target) => (
          <Pressable
            key={target}
            style={({ pressed }) => [
              styles.chip,
              hero && styles.chipHero,
              hero && embedded && styles.chipEmbedded,
              pressed && styles.chipPressed,
            ]}
            disabled={busy}
            onPress={() => void props.onSaveGoal(target, false)}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text style={styles.chipValue}>{target}</Text>
                <Text style={styles.chipLabel}>{t("stats.yourWeek.sessionsUnit")}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => editor.openEditor(5)} disabled={busy}>
        <Text style={styles.customLink}>{t("stats.yourWeek.customTarget")}</Text>
      </Pressable>
    </View>
  );
}

export function YourWeekProgress({ props, editor, model }: SectionProps) {
  const { t, goal, forecast, commitment, hero = false, busy } = props;
  return (
    <>
      <View style={styles.metricRow}>
        <Text style={[styles.bigNumber, hero && styles.bigNumberHero]}>
          {goal?.current_sessions ?? 0}
          <Text style={styles.bigNumberDim}> / {goal?.target_value ?? "—"}</Text>
        </Text>
        <Text style={styles.metricLabel}>{t("stats.yourWeek.sessionsThisWeek")}</Text>
      </View>
      {!hero ? (
        <View
          style={[
            styles.statusPill,
            model.status === "on_track" && styles.statusOnTrack,
            model.status === "behind" && styles.statusBehind,
            model.status === "completed" && styles.statusDone,
          ]}
        >
          <Text style={styles.statusText}>
            {t(
              model.status === "completed"
                ? "stats.yourWeek.statusCompleted"
                : model.status === "behind"
                  ? "stats.yourWeek.statusBehind"
                  : "stats.yourWeek.statusOnTrack",
            )}
          </Text>
        </View>
      ) : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${model.progressPercent}%` }]} />
      </View>
      {hero && model.nextStep ? (
        <Text style={styles.nextStep} numberOfLines={2}>
          {model.nextStep}
        </Text>
      ) : null}
      {!hero && forecast && model.forecastRiskKey ? (
        <Text
          style={[
            styles.forecastLine,
            forecast.risk_level === "on_track" && styles.forecastOnTrack,
            forecast.risk_level === "at_risk" && styles.forecastAtRisk,
            forecast.risk_level === "off_track" && styles.forecastOffTrack,
          ]}
        >
          {t(model.forecastRiskKey)} ·{" "}
          {t("stats.forecastRemaining", {
            n: forecast.remaining_sessions,
            days: forecast.days_left,
          })}
        </Text>
      ) : null}
      {!hero ? <StudioDays model={model} t={t} /> : null}
      {!hero && commitment ? <CommitmentLine commitment={commitment} t={t} /> : null}
      <PrimaryButton
        label={busy ? t("stats.yourWeek.saving") : model.primaryLabel}
        onPress={model.primaryAction}
        disabled={busy}
      />
      {model.status !== "completed" ? (
        <Pressable onPress={() => editor.openEditor()} disabled={busy} style={styles.editLink}>
          <Text style={styles.editLinkText}>{t("stats.yourWeek.editGoal")}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function StudioDays({ model, t }: { model: YourWeekCardModel; t: YourWeekCardProps["t"] }) {
  return (
    <>
      <Text style={styles.studioLabel}>{t("stats.yourWeek.studioDays")}</Text>
      <View style={styles.dayRow}>
        {model.weekKeys.map((key, index) => {
          const active = model.activeDayKeys.has(key);
          return (
            <View key={key} style={styles.dayCell}>
              <View
                style={[
                  styles.dayDot,
                  active && styles.dayDotActive,
                  key === model.todayKey && styles.dayDotToday,
                ]}
              />
              <Text style={[styles.dayLetter, active && styles.dayLetterActive]}>
                {model.weekdayLetters[index]}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function CommitmentLine({
  commitment,
  t,
}: {
  commitment: NonNullable<YourWeekCardProps["commitment"]>;
  t: YourWeekCardProps["t"];
}) {
  const names = commitment.witness_usernames;
  return (
    <View style={styles.promiseRow}>
      <Text style={styles.promiseText}>
        {names?.length
          ? t("stats.yourWeek.sharedWith", { names: names.map((name) => `@${name}`).join(", ") })
          : t("stats.yourWeek.sharedWithFriends")}
      </Text>
    </View>
  );
}
