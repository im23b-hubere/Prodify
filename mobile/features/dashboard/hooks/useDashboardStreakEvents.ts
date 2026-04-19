import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";

import { STREAK_MILESTONES } from "../../../lib/streakMilestones";
import { prependNotification } from "../../../lib/notificationInbox";
import type { StreakOverviewDto } from "../../../types/streak";

type Params = {
  streakOverview: StreakOverviewDto | null;
  userScopedMilestoneKey: string;
  userScopedStreakKey: string;
  t: TFunction;
  refreshUnread: () => void;
};

export function useDashboardStreakEvents({
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
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync(userScopedMilestoneKey);
        const maxSeen = raw ? parseInt(raw, 10) : 0;
        const newlyPassed = STREAK_MILESTONES.filter((m) => cur >= m.days && m.days > maxSeen);
        const best = newlyPassed.length ? newlyPassed[newlyPassed.length - 1] : null;
        if (!best) return;

        await SecureStore.setItemAsync(userScopedMilestoneKey, String(best.days));
        setMilestoneToast(`${best.title} — ${best.reward}`);
        prependNotification({
          category: "achievement",
          title: t("dashboard.milestoneNotifTitle"),
          body: `${best.title} — ${best.reward}`,
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
  }, [streakOverview, userScopedMilestoneKey, t, refreshUnread]);

  useEffect(() => {
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    void (async () => {
      try {
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
  }, [streakOverview, userScopedStreakKey]);

  return {
    milestoneToast,
    breakModalOpen,
    breakModalStreak,
    dismissBreakModal,
  };
}
