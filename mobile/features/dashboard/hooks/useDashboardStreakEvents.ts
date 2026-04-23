import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";

import { STREAK_MILESTONES } from "../../../lib/streakMilestones";
import { prependNotification } from "../../../lib/notificationInbox";
import type { StreakOverviewDto } from "../../../types/streak";

type Params = {
  userId?: number;
  streakOverview: StreakOverviewDto | null;
  userScopedMilestoneKey: string;
  userScopedStreakKey: string;
  t: TFunction;
  refreshUnread: () => void;
};

export function useDashboardStreakEvents({
  userId,
  streakOverview,
  userScopedMilestoneKey,
  userScopedStreakKey,
  t,
  refreshUnread,
}: Params) {
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakModalStreak, setBreakModalStreak] = useState(0);
  const clearToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleHapticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedUserRef = useRef<number | null>(null);
  const initializedMilestoneUserRef = useRef<number | null>(null);

  const dismissBreakModal = useCallback(() => {
    setBreakModalOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (clearToastTimeoutRef.current) {
        clearTimeout(clearToastTimeoutRef.current);
      }
      if (doubleHapticTimeoutRef.current) {
        clearTimeout(doubleHapticTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Reset transient UI when account context changes to avoid stale modals.
    setBreakModalOpen(false);
    setBreakModalStreak(0);
    setMilestoneToast(null);
  }, [userId]);

  useEffect(() => {
    if (!streakOverview || typeof userId !== "number") return;
    const cur = streakOverview.current_streak;
    void (async () => {
      try {
        if (initializedMilestoneUserRef.current !== userId) {
          initializedMilestoneUserRef.current = userId;
          await SecureStore.setItemAsync(userScopedMilestoneKey, String(cur));
          return;
        }
        const raw = await SecureStore.getItemAsync(userScopedMilestoneKey);
        const maxSeen = raw ? parseInt(raw, 10) : 0;
        const newlyPassed = STREAK_MILESTONES.filter((m) => cur >= m.days && m.days > maxSeen);
        const best = newlyPassed.length ? newlyPassed[newlyPassed.length - 1] : null;
        if (!best) return;

        await SecureStore.setItemAsync(userScopedMilestoneKey, String(best.days));
        setMilestoneToast(`${best.title} — ${best.reward}`);
        prependNotification({
          category: "achievement",
          priority: "high",
          title: t("dashboard.milestoneNotifTitle"),
          body: `${best.title} — ${best.reward}`,
          ttlMs: 30 * 24 * 60 * 60 * 1000,
          dedupeWindowMs: 12 * 60 * 60 * 1000,
          bypassFirstWeekQuietMode: true,
        }).catch(() => undefined);
        refreshUnread();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

        if (doubleHapticTimeoutRef.current) {
          clearTimeout(doubleHapticTimeoutRef.current);
        }
        doubleHapticTimeoutRef.current = setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
        }, 120);

        if (clearToastTimeoutRef.current) {
          clearTimeout(clearToastTimeoutRef.current);
        }
        clearToastTimeoutRef.current = setTimeout(() => setMilestoneToast(null), 4200);
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview, userId, userScopedMilestoneKey, t, refreshUnread]);

  useEffect(() => {
    if (!streakOverview || typeof userId !== "number") return;
    const cur = streakOverview.current_streak;
    void (async () => {
      try {
        if (initializedUserRef.current !== userId) {
          initializedUserRef.current = userId;
          await SecureStore.setItemAsync(userScopedStreakKey, String(cur));
          return;
        }
        const raw = await SecureStore.getItemAsync(userScopedStreakKey);
        const prev = raw ? parseInt(raw, 10) : 0;
        if (prev > 0 && cur === 0) {
          setBreakModalStreak(prev);
          setBreakModalOpen(true);
        }
        await SecureStore.setItemAsync(userScopedStreakKey, String(cur));
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview, userId, userScopedStreakKey]);

  return {
    milestoneToast,
    breakModalOpen,
    breakModalStreak,
    dismissBreakModal,
  };
}
