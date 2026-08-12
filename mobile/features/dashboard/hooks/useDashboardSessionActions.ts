import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import { debugLog } from "../../../lib/debugLog";
import { setWeeklyGoal } from "../../../lib/goals";
import { effectiveElapsedSeconds, formatDurationWords } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";

type UseDashboardSessionActionsOptions = {
  token?: string | null;
  active: SessionDto | null;
  suggestedSessionType: string;
  displayOverview: StreakOverviewDto | null;
  t: TFunction;
  setActive: (session: SessionDto | null) => void;
  setError: (error: string | null) => void;
  setRefreshing: (refreshing: boolean) => void;
  loadSessions: () => Promise<unknown>;
  loadStreakOverview: () => Promise<unknown>;
  refreshDashboard: (options: { force?: boolean; withLoading?: boolean }) => Promise<unknown>;
};

export function useDashboardSessionActions({
  token,
  active,
  suggestedSessionType,
  displayOverview,
  t,
  setActive,
  setError,
  setRefreshing,
  loadSessions,
  loadStreakOverview,
  refreshDashboard,
}: UseDashboardSessionActionsOptions) {
  const router = useRouter();
  const [stopBusy, setStopBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const stopSessionInFlight = useRef(false);

  const openFullscreenActive = useCallback(() => {
    if (!active || typeof active.id !== "number" || !Number.isFinite(active.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({
      pathname: "/session-active",
      params: { id: String(active.id), source: "dashboard" },
    });
  }, [active, router]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await refreshDashboard({ force: true, withLoading: false }).catch(() => undefined);
    setRefreshing(false);
  }, [refreshDashboard, setRefreshing]);

  const openSessionSetup = useCallback(() => {
    if (active) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({
      pathname: "/session/setup",
      params: { suggestedType: suggestedSessionType, source: "dashboard" },
    });
  }, [active, router, suggestedSessionType]);

  const openStats = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.push({ pathname: "/(tabs)/stats", params: { focus: "yourWeek" } });
  }, [router]);

  const saveWeeklyGoal = useCallback(
    async (target: number) => {
      if (!token) return;
      setGoalSaving(true);
      try {
        await setWeeklyGoal(token, target);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        await refreshDashboard({ force: true });
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setError(error instanceof Error ? error.message : t("dashboard.weeklyGoalSaveFailed"));
      } finally {
        setGoalSaving(false);
      }
    },
    [refreshDashboard, setError, t, token],
  );

  const useFreeze = useCallback(async () => {
    if (!token) return;
    setFreezeBusy(true);
    try {
      await apiJson("/streak/freeze", { token, method: "POST", body: {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await loadStreakOverview();
      await loadSessions();
      Alert.alert(t("dashboard.freezeSuccessTitle"), t("dashboard.freezeSuccessBody"));
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert(
        t("dashboard.freezeErrorTitle"),
        error instanceof Error ? error.message : t("dashboard.freezeTryAgain"),
      );
    } finally {
      setFreezeBusy(false);
    }
  }, [loadSessions, loadStreakOverview, t, token]);

  const explainFreezeUnavailable = useCallback(() => {
    if (!displayOverview) return;
    let reasonKey = "dashboard.freezeReasonAlreadySafeToday";
    if (displayOverview.freezes_remaining < 1) reasonKey = "dashboard.freezeReasonNoneLeft";
    else if (!displayOverview.streak_at_risk) reasonKey = "dashboard.freezeReasonNotAtRisk";
    Alert.alert(t("dashboard.freezeUnavailableTitle"), t(reasonKey));
  }, [displayOverview, t]);

  const stopSession = useCallback(
    async (session: SessionDto) => {
      if (!token || stopSessionInFlight.current) return;
      stopSessionInFlight.current = true;
      setStopBusy(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        debugLog("session", "stop_attempt", { sessionId: session.id });
        await apiJson<SessionDto>("/sessions/stop", {
          token,
          method: "POST",
          body: { session_id: session.id },
        });
        debugLog("session", "stop_success", { sessionId: session.id });
        setActive(null);
        router.replace({ pathname: "/session/complete", params: { id: String(session.id) } });
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        const message = error instanceof Error ? error.message : t("dashboard.stopFailed");
        debugLog("session", "stop_failure", { sessionId: session.id, message });
        setError(message);
        await loadSessions().catch(() => undefined);
      } finally {
        stopSessionInFlight.current = false;
        setStopBusy(false);
      }
    },
    [loadSessions, router, setActive, setError, t, token],
  );

  const confirmStop = useCallback(() => {
    if (!active || !token || stopSessionInFlight.current) return;
    const elapsed = effectiveElapsedSeconds(active, Date.now());
    Alert.alert(
      t("dashboard.endSessionTitle"),
      t("dashboard.endSessionWorked", { duration: formatDurationWords(elapsed) }),
      [
        { text: t("dashboard.keepGoing"), style: "cancel" },
        {
          text: t("dashboard.endSessionConfirm"),
          style: "destructive",
          onPress: () => stopSession(active),
        },
      ],
    );
  }, [active, stopSession, t, token]);

  const dismissSession = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
        await loadSessions();
      } catch (error) {
        setError(error instanceof Error ? error.message : t("dashboard.deleteFailed"));
      }
    },
    [loadSessions, setError, t, token],
  );

  return {
    stopBusy,
    freezeBusy,
    goalSaving,
    openFullscreenActive,
    refresh,
    openSessionSetup,
    openStats,
    saveWeeklyGoal,
    useFreeze,
    explainFreezeUnavailable,
    confirmStop,
    dismissSession,
  };
}
