import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert } from "react-native";

import type { MomentumAction } from "../../../lib/momentum";
import { rescueBuddyStreak } from "../../../lib/social";
import type { BuddyRiskDto, IdentityStateDto } from "../../../types/friends";
import type { DashboardPrimaryNudge } from "./useDashboardSocialNudges";

export type DashboardSocialRouter = { push: (href: Href) => void };

type Params = {
  token: string | null;
  userId: number | undefined;
  buddyRisk: BuddyRiskDto | null;
  primaryNudge: DashboardPrimaryNudge | null;
  identityState: IdentityStateDto | null;
  router: DashboardSocialRouter;
  t: TFunction;
  loadSocial: () => Promise<void>;
  advancePrimaryNudge: (category: string) => Promise<void>;
  applyMomentumAction: (uid: number, action: MomentumAction) => Promise<void>;
  setSocialActionBusy: Dispatch<SetStateAction<string | null>>;
};

type IdentityFeedback = { rescue: string; session: string };

export function useDashboardSocialActions(params: Params) {
  const { socialToast, showSocialToast } = useSocialToast();
  const identityFeedback = useIdentityFeedback(params.identityState, params.t);
  const runRescueNow = useRescueAction(params, identityFeedback, showSocialToast);
  const runStartSessionNow = useStartSessionAction(params, identityFeedback, showSocialToast);
  const runPrimaryAction = useCallback(() => {
    const nudge = params.primaryNudge;
    if (!nudge) return;
    if (nudge.actionKey === "rescue") return void runRescueNow();
    if (nudge.actionKey === "start_session") return void runStartSessionNow(nudge.category);
    params.router.push("/(tabs)/friends");
  }, [params.primaryNudge, params.router, runRescueNow, runStartSessionNow]);

  return { socialToast, runRescueNow, runStartSessionNow, runPrimaryAction };
}

function useSocialToast() {
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );
  const showSocialToast = useCallback((message: string) => {
    setSocialToast(message);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSocialToast(null), 1700);
  }, []);
  return { socialToast, showSocialToast };
}

function useIdentityFeedback(identityState: IdentityStateDto | null, t: TFunction) {
  return useMemo<IdentityFeedback>(() => {
    const tag = identityState?.primary_tag;
    return {
      rescue: t(
        tag === "collaborative"
          ? "dashboard.identityRescueCollaborative"
          : "dashboard.identityRescueDefault",
      ),
      session: t(
        tag === "locked_in"
          ? "dashboard.identitySessionLockedIn"
          : "dashboard.identitySessionDefault",
      ),
    };
  }, [identityState?.primary_tag, t]);
}

function useRescueAction(
  params: Params,
  feedback: IdentityFeedback,
  showToast: (message: string) => void,
) {
  const { advancePrimaryNudge, applyMomentumAction, buddyRisk, loadSocial } = params;
  const { router, setSocialActionBusy, t, token, userId } = params;
  return useCallback(() => {
    if (!token || !buddyRisk?.buddy_user_id || !buddyRisk.rescue_available) return;
    Alert.alert(t("dashboard.rescueTitle"), t("dashboard.rescueBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("dashboard.nudgeCtaKeepAlive"),
        style: "default",
        onPress: async () => {
          setSocialActionBusy("rescue");
          try {
            await rescueBuddyStreak(token, buddyRisk.buddy_user_id as number);
            await loadSocial();
            if (userId) await applyMomentumAction(userId, "rescue");
            showToast(feedback.rescue);
            await advancePrimaryNudge("buddy_risk");
            showRescueSuccess(t, router);
          } catch (error) {
            showActionError(t, "dashboard.couldNotSendSupport", error);
          } finally {
            setSocialActionBusy(null);
          }
        },
      },
    ]);
  }, [
    advancePrimaryNudge,
    applyMomentumAction,
    buddyRisk,
    feedback.rescue,
    loadSocial,
    router,
    setSocialActionBusy,
    showToast,
    t,
    token,
    userId,
  ]);
}

function useStartSessionAction(
  params: Params,
  feedback: IdentityFeedback,
  showToast: (message: string) => void,
) {
  const { advancePrimaryNudge, applyMomentumAction, router } = params;
  const { setSocialActionBusy, t, token, userId } = params;
  return useCallback(
    async (category: string) => {
      if (!token) return;
      setSocialActionBusy("commitment");
      try {
        if (userId) await applyMomentumAction(userId, "session");
        showToast(feedback.session);
        await advancePrimaryNudge(category);
        router.push("/session/setup");
      } catch (error) {
        showActionError(t, "dashboard.couldNotStartProducing", error);
      } finally {
        setSocialActionBusy(null);
      }
    },
    [
      advancePrimaryNudge,
      applyMomentumAction,
      feedback.session,
      router,
      setSocialActionBusy,
      showToast,
      t,
      token,
      userId,
    ],
  );
}

function showRescueSuccess(t: TFunction, router: DashboardSocialRouter) {
  Alert.alert(t("dashboard.rescueSuccessTitle"), t("dashboard.rescueSuccessBody"), [
    { text: t("dashboard.later"), style: "cancel" },
    { text: t("dashboard.inviteProducer"), onPress: () => router.push("/(tabs)/friends") },
  ]);
}

function showActionError(t: TFunction, titleKey: string, error: unknown) {
  Alert.alert(t(titleKey), error instanceof Error ? error.message : t("common.tryAgain"));
}
