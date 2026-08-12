import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";

import type { StreakOverviewDto } from "../../../types/streak";

type Params = {
  userId?: number;
  streakOverview: StreakOverviewDto | null;
  storageKey: string;
};

export function useDashboardStreakBreakEvent({ userId, streakOverview, storageKey }: Params) {
  const [isOpen, setIsOpen] = useState(false);
  const [previousStreak, setPreviousStreak] = useState(0);
  const initializedUser = useRef<number | null>(null);
  const inFlightEvent = useRef<string | null>(null);
  const handledEvent = useRef<string | null>(null);
  const dismiss = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    setIsOpen(false);
    setPreviousStreak(0);
  }, [userId]);

  useEffect(() => {
    if (!streakOverview || typeof userId !== "number") return;
    const currentStreak = streakOverview.current_streak;
    const eventKey = `${userId}:${currentStreak}`;
    if (inFlightEvent.current === eventKey || handledEvent.current === eventKey) return;
    inFlightEvent.current = eventKey;

    void (async () => {
      try {
        if (initializedUser.current !== userId) {
          initializedUser.current = userId;
          await SecureStore.setItemAsync(storageKey, String(currentStreak));
          handledEvent.current = eventKey;
          return;
        }
        const stored = (await SecureStore.getItemAsync(storageKey)) ?? "0";
        const previous = Number.parseInt(stored, 10);
        if (previous > 0 && currentStreak === 0) {
          setPreviousStreak(previous);
          setIsOpen(true);
        }
        await SecureStore.setItemAsync(storageKey, String(currentStreak));
        handledEvent.current = eventKey;
      } catch {
        // Persisted dashboard hints are best effort and must never block the dashboard.
      } finally {
        inFlightEvent.current = null;
      }
    })();
  }, [storageKey, streakOverview, userId]);

  return { isOpen, previousStreak, dismiss };
}
