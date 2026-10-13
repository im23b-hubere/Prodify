import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";

import { loadCelebratedFullWeek, saveCelebratedFullWeek } from "../fullWeekCelebrated";
import { uncelebratedFullWeekStart } from "../utils/studioWeek";
import type { HeatmapDay } from "../types";

type Options = {
  today?: Date;
};

type StoredCelebration = { userId: number; weekStart: string | null };

export function useFullWeekCelebrate(
  userId: number | null | undefined,
  heatmapDays: HeatmapDay[],
  options: Options = {},
) {
  const today = options.today;
  const [stored, setStored] = useState<StoredCelebration | null>(null);
  const firedForWeek = useRef<string | null>(null);
  const storageReady = userId != null && stored?.userId === userId;
  const celebratedWeekStart = storageReady ? stored.weekStart : null;

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    loadCelebratedFullWeek(userId).then((weekStart) => {
      if (cancelled) return;
      setStored({ userId, weekStart });
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
    void saveCelebratedFullWeek(userId, weekStart);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [celebratedWeekStart, heatmapDays, storageReady, today, userId]);
}
