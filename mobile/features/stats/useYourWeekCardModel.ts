import { useMemo } from "react";

import { WEEKDAY_LETTERS, currentWeekDateKeys, localDateKey } from "../../lib/weekCalendar";
import type { YourWeekCardProps } from "../../components/stats/YourWeekCard";
import {
  activeHeatmapDayKeys,
  forecastRiskTranslationKey,
  goalProgressPercent,
  yourWeekNextStep,
  yourWeekStatus,
} from "./yourWeekPresentation";
import type { YourWeekGoalEditorState } from "./useYourWeekGoalEditor";

export function useYourWeekCardModel(props: YourWeekCardProps, editor: YourWeekGoalEditorState) {
  const status = yourWeekStatus(props.goal, props.forecast, props.configured);
  const weekKeys = useMemo(() => currentWeekDateKeys(), []);
  const activeDayKeys = useMemo(() => activeHeatmapDayKeys(props.heatmapDays), [props.heatmapDays]);
  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const nextStep = useMemo(
    () => yourWeekNextStep(props.goal, props.forecast, props.configured, status, props.t),
    [props.configured, props.forecast, props.goal, props.t, status],
  );
  const primaryLabel =
    status === "setup"
      ? props.t("stats.yourWeek.setTargetCta")
      : status === "completed"
        ? props.t("stats.yourWeek.raiseTargetCta")
        : status === "behind"
          ? props.t("stats.yourWeek.catchUpCta")
          : props.t("stats.yourWeek.startSessionCta");
  const primaryAction = () => {
    if (status === "setup") return editor.openEditor(5);
    if (status === "completed") return editor.openEditor((props.goal?.target_value ?? 5) + 1);
    props.onStartSession();
  };
  return {
    status,
    weekKeys,
    weekdayLetters: WEEKDAY_LETTERS,
    activeDayKeys,
    todayKey,
    nextStep,
    primaryLabel,
    primaryAction,
    progressPercent: goalProgressPercent(props.goal),
    forecastRiskKey: forecastRiskTranslationKey(props.forecast),
  };
}

export type YourWeekCardModel = ReturnType<typeof useYourWeekCardModel>;
