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

type Options = {
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

type Router = ReturnType<typeof useRouter>;

export function useDashboardSessionActions(options: Options) {
  const router = useRouter();
  const navigation = useSessionNavigation(options, router);
  const goal = useWeeklyGoalAction(options);
  const freeze = useFreezeActions(options);
  const completion = useSessionCompletionActions(options, router);
  const dismissSession = useDismissSession(options);
  return { ...navigation, ...goal, ...freeze, ...completion, dismissSession };
}

function useSessionNavigation(options: Options, router: Router) {
  const { active, refreshDashboard, setRefreshing, suggestedSessionType } = options;
  const openFullscreenActive = useCallback(() => {
    if (!active || typeof active.id !== "number" || !Number.isFinite(active.id)) return;
    ignoreHaptic(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    router.push({
      pathname: "/session-active",
      params: { id: String(active.id), source: "dashboard" },
    });
  }, [active, router]);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    ignoreHaptic(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    await refreshDashboard({ force: true, withLoading: false }).catch(() => undefined);
    setRefreshing(false);
  }, [refreshDashboard, setRefreshing]);
  const openSessionSetup = useCallback(() => {
    if (active) {
      ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      return;
    }
    ignoreHaptic(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    router.push({
      pathname: "/session/setup",
      params: { suggestedType: suggestedSessionType, source: "dashboard" },
    });
  }, [active, router, suggestedSessionType]);
  const openStats = useCallback(() => {
    ignoreHaptic(Haptics.selectionAsync());
    router.push({ pathname: "/(tabs)/stats", params: { focus: "yourWeek" } });
  }, [router]);
  return { openFullscreenActive, refresh, openSessionSetup, openStats };
}

function useWeeklyGoalAction({ refreshDashboard, setError, t, token }: Options) {
  const [goalSaving, setGoalSaving] = useState(false);
  const saveWeeklyGoal = useCallback(
    async (target: number) => {
      if (!token) return;
      setGoalSaving(true);
      try {
        await setWeeklyGoal(token, target);
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        await refreshDashboard({ force: true });
      } catch (error) {
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        setError(error instanceof Error ? error.message : t("dashboard.weeklyGoalSaveFailed"));
      } finally {
        setGoalSaving(false);
      }
    },
    [refreshDashboard, setError, t, token],
  );
  return { goalSaving, saveWeeklyGoal };
}

function useFreezeActions({
  displayOverview,
  loadSessions,
  loadStreakOverview,
  t,
  token,
}: Options) {
  const [freezeBusy, setFreezeBusy] = useState(false);
  const useFreeze = useCallback(async () => {
    if (!token) return;
    setFreezeBusy(true);
    try {
      await apiJson("/streak/freeze", { token, method: "POST", body: {} });
      ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      await loadStreakOverview();
      await loadSessions();
      Alert.alert(t("dashboard.freezeSuccessTitle"), t("dashboard.freezeSuccessBody"));
    } catch (error) {
      ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
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
  return { freezeBusy, useFreeze, explainFreezeUnavailable };
}

function useSessionCompletionActions(options: Options, router: Router) {
  const { active, loadSessions, setActive, setError, t, token } = options;
  const [stopBusy, setStopBusy] = useState(false);
  const inFlight = useRef(false);
  const stopSession = useCallback(
    async (session: SessionDto) => {
      if (!token || inFlight.current) return;
      inFlight.current = true;
      setStopBusy(true);
      try {
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
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
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        const message = error instanceof Error ? error.message : t("dashboard.stopFailed");
        debugLog("session", "stop_failure", { sessionId: session.id, message });
        setError(message);
        await loadSessions().catch(() => undefined);
      } finally {
        inFlight.current = false;
        setStopBusy(false);
      }
    },
    [loadSessions, router, setActive, setError, t, token],
  );
  const confirmStop = useCallback(() => {
    if (!active || !token || inFlight.current) return;
    const duration = formatDurationWords(effectiveElapsedSeconds(active, Date.now()));
    Alert.alert(t("dashboard.endSessionTitle"), t("dashboard.endSessionWorked", { duration }), [
      { text: t("dashboard.keepGoing"), style: "cancel" },
      {
        text: t("dashboard.endSessionConfirm"),
        style: "destructive",
        onPress: () => stopSession(active),
      },
    ]);
  }, [active, stopSession, t, token]);
  return { stopBusy, confirmStop };
}

function useDismissSession({ loadSessions, setError, t, token }: Options) {
  return useCallback(
    async (sessionId: number) => {
      if (!token) return;
      ignoreHaptic(Haptics.selectionAsync());
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
        await loadSessions();
      } catch (error) {
        setError(error instanceof Error ? error.message : t("dashboard.deleteFailed"));
      }
    },
    [loadSessions, setError, t, token],
  );
}

function ignoreHaptic(request: Promise<void>) {
  request.catch(() => undefined);
}
