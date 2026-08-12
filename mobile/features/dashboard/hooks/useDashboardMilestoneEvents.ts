import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import { prependNotification } from "../../../lib/notificationInbox";
import { latestNewMilestone } from "../../../lib/streakMilestones";
import type { StreakOverviewDto } from "../../../types/streak";

type Params = {
  userId?: number;
  streakOverview: StreakOverviewDto | null;
  storageKey: string;
  t: TFunction;
  refreshUnread: () => void;
};

type Timer = ReturnType<typeof setTimeout>;

function clearTimer(timer: MutableRefObject<Timer | null>) {
  if (timer.current) clearTimeout(timer.current);
}

export function useDashboardMilestoneEvents({
  userId,
  streakOverview,
  storageKey,
  t,
  refreshUnread,
}: Params) {
  const [toast, setToast] = useState<string | null>(null);
  const initializedUser = useRef<number | null>(null);
  const inFlightEvent = useRef<string | null>(null);
  const handledEvent = useRef<string | null>(null);
  const toastTimer = useRef<Timer | null>(null);
  const secondHapticTimer = useRef<Timer | null>(null);

  useEffect(
    () => () => {
      clearTimer(toastTimer);
      clearTimer(secondHapticTimer);
    },
    [],
  );
  useEffect(() => setToast(null), [userId]);

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
        const milestone = latestNewMilestone(currentStreak, Number.parseInt(stored, 10));
        handledEvent.current = eventKey;
        if (!milestone) return;

        await SecureStore.setItemAsync(storageKey, String(milestone.days));
        const message = `${milestone.title} — ${milestone.reward}`;
        setToast(message);
        notifyMilestone(message, t, refreshUnread);
        clearTimer(secondHapticTimer);
        secondHapticTimer.current = setTimeout(playSuccessHaptic, 120);
        clearTimer(toastTimer);
        toastTimer.current = setTimeout(() => setToast(null), 4200);
      } catch {
        // Persisted dashboard hints are best effort and must never block the dashboard.
      } finally {
        inFlightEvent.current = null;
      }
    })();
  }, [refreshUnread, storageKey, streakOverview, t, userId]);

  return toast;
}

function playSuccessHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

function notifyMilestone(message: string, t: TFunction, refreshUnread: () => void) {
  void prependNotification({
    category: "achievement",
    priority: "high",
    title: t("dashboard.milestoneNotifTitle"),
    body: message,
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    dedupeWindowMs: 12 * 60 * 60 * 1000,
    bypassFirstWeekQuietMode: true,
  }).catch(() => undefined);
  refreshUnread();
  playSuccessHaptic();
}
