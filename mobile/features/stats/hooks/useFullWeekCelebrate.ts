import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";

import { loadCelebratedFullWeek, saveCelebratedFullWeek } from "../fullWeekCelebrated";
import { uncelebratedFullWeekStart } from "../utils/studioWeek";
import type { HeatmapDay } from "../types";

type Options = {
  today?: Date;
};

export function useFullWeekCelebrate(
  userId: number | null | undefined,
  heatmapDays: HeatmapDay[],
  options: Options = {},
) {
  const today = options.today;
  const [celebratedWeekStart, setCelebratedWeekStart] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const firedForWeek = useRef<string | null>(null);

  useEffect(() => {
    if (userId == null) {
      setStorageReady(false);
      setCelebratedWeekStart(null);
      return;
    }
    let cancelled = false;
    setStorageReady(false);
    loadCelebratedFullWeek(userId).then((weekStart) => {
      if (cancelled) return;
      setCelebratedWeekStart(weekStart);
      setStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (userId == null) return;
    const weekStart = uncelebratedFullWeekStart(
      heatmapDays,
      celebratedWeekStart,
      storageReady,
      today,
    );
    if (!weekStart || firedForWeek.current === weekStart) return;
    firedForWeek.current = weekStart;
    setCelebratedWeekStart(weekStart);
    void saveCelebratedFullWeek(userId, weekStart);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [celebratedWeekStart, heatmapDays, storageReady, today, userId]);
}
