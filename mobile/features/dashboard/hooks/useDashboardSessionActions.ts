import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

import { useIsScreenFocused } from "../../../hooks/useIsScreenFocused";
import { ApiError, apiJson } from "../../../lib/client";
import { resumeActiveSession } from "../../sessions/services/activeSessionApi";
import { sessionSummaryHref } from "../../../lib/stackNavigation";
import { debugLog } from "../../../lib/debugLog";
import { effectiveElapsedSeconds, formatDurationWords } from "../../../lib/sessionTime";
import { userFacingErrorMessage } from "../../../lib/userFacingErrorMessage";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";
import { useSessionPresenceCheckIn } from "../../sessions/hooks/useSessionPresenceCheckIn";

type Options = {
  token?: string | null;
  active: SessionDto | null;
  activeResolved: boolean;
  suggestedSessionType: string;
  displayOverview: StreakOverviewDto | null;
  t: TFunction;
  setActive: (session: SessionDto | null) => void;
  setError: (error: string | null) => void;
  setRefreshing: (refreshing: boolean) => void;
  loadSessions: () => Promise<unknown>;
  loadStreakOverview: () => Promise<unknown>;
  refreshDashboard: (options: { force?: boolean; withLoading?: boolean }) => Promise<unknown>;
  invalidateDashboard: () => void;
};

type Router = ReturnType<typeof useRouter>;

export function useDashboardSessionActions(options: Options) {
  const router = useRouter();
  const navigation = useSessionNavigation(options, router);
  const freeze = useFreezeActions(options);
  const { stopSession, ...completion } = useSessionCompletionActions(options, router);
  const resume = useResumePausedSession(options);
  const dismissSession = useDismissSession(options);
  useDashboardSessionPresence(options, stopSession);
  return { ...navigation, ...freeze, ...completion, ...resume, dismissSession };
}

function useSessionNavigation(options: Options, router: Router) {
  const {
    active,
    activeResolved,
    invalidateDashboard,
    refreshDashboard,
    setRefreshing,
    suggestedSessionType,
  } = options;
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
    if (!activeResolved || active) {
      if (active) {
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      }
      return;
    }
    ignoreHaptic(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    invalidateDashboard();
    router.push({
      pathname: "/session/setup",
      params: { suggestedType: suggestedSessionType, source: "dashboard" },
    });
  }, [active, activeResolved, invalidateDashboard, router, suggestedSessionType]);
  return { openFullscreenActive, refresh, openSessionSetup };
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
        userFacingErrorMessage(error, t, "dashboard.freezeTryAgain"),
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
  const { active, invalidateDashboard, loadSessions, setActive, setError, t, token } = options;
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
        invalidateDashboard();
        router.push(sessionSummaryHref(session.id));
        return true;
      } catch (error) {
        ignoreHaptic(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        const message = userFacingErrorMessage(error, t, "dashboard.stopFailed");
        debugLog("session", "stop_failure", { sessionId: session.id, message });
        setError(message);
        await loadSessions().catch(() => undefined);
        return false;
      } finally {
        inFlight.current = false;
        setStopBusy(false);
      }
    },
    [invalidateDashboard, loadSessions, router, setActive, setError, t, token],
  );
  const confirmStop = useCallback(() => {
    if (!active || !token || inFlight.current) return;
    const duration = formatDurationWords(effectiveElapsedSeconds(active, Date.now()), t);
    Alert.alert(t("dashboard.endSessionTitle"), t("dashboard.endSessionWorked", { duration }), [
      { text: t("dashboard.keepGoing"), style: "cancel" },
      {
        text: t("dashboard.endSessionConfirm"),
        style: "destructive",
        onPress: () => stopSession(active),
      },
    ]);
  }, [active, stopSession, t, token]);
  return { stopBusy, confirmStop, stopSession };
}

function useResumePausedSession({ active, loadSessions, setActive, setError, t, token }: Options) {
  const [resumeBusy, setResumeBusy] = useState(false);
  const resumePaused = useCallback(async () => {
    if (!token || !active?.pause_started_at) return;
    setResumeBusy(true);
    try {
      const updated = await resumeActiveSession(token, active.id);
      if (updated && updated.stopped_at == null) {
        setActive(updated);
        return;
      }
      await loadSessions();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 400)) {
        setError(userFacingErrorMessage(error, t, "sessionActive.resumeFailed"));
      }
      await loadSessions().catch(() => undefined);
    } finally {
      setResumeBusy(false);
    }
  }, [active, loadSessions, setActive, setError, t, token]);
  return { resumePaused, resumeBusy };
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
        setError(userFacingErrorMessage(error, t, "dashboard.deleteFailed"));
      }
    },
    [loadSessions, setError, t, token],
  );
}

function ignoreHaptic(request: Promise<void>) {
  request.catch(() => undefined);
}

function useDashboardSessionPresence(
  options: Options,
  stopSession: (session: SessionDto) => Promise<boolean | void>,
) {
  const { active, activeResolved } = options;
  const isFocused = useIsScreenFocused();
  useSessionPresenceCheckIn({
    enabled: isFocused,
    session: active,
    sessionResolved: activeResolved,
    endSession: () => {
      if (!active) return false;
      return stopSession(active);
    },
  });
}

