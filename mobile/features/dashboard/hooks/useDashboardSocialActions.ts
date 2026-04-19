import type { TFunction } from "i18next";
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import type { MomentumAction } from "../../../lib/momentum";
import { rescueBuddyStreak } from "../../../lib/social";
import type { BuddyRiskDto, IdentityStateDto } from "../../../types/friends";
import type { DashboardPrimaryNudge } from "./useDashboardSocialNudges";

/** Minimal navigation surface used by social actions (Expo Router–compatible). */
export type DashboardSocialRouter = {
  push: (href: string) => void;
};

type Params = {
  token: string | null;
  userId: number | undefined;
  buddyRisk: BuddyRiskDto | null;
  primaryNudge: DashboardPrimaryNudge | null;
  identityState: IdentityStateDto | null;
  router: DashboardSocialRouter;
  t: TFunction;
  loadSocial: () => Promise<void>;
  loadSessions: () => Promise<void>;
  advancePrimaryNudge: (category: string) => Promise<void>;
  applyMomentumAction: (uid: number, action: MomentumAction) => Promise<void>;
  setSocialActionBusy: Dispatch<SetStateAction<string | null>>;
};

export function useDashboardSocialActions({
  token,
  userId,
  buddyRisk,
  primaryNudge,
  identityState,
  router,
  t,
  loadSocial,
  loadSessions,
  advancePrimaryNudge,
  applyMomentumAction,
  setSocialActionBusy,
}: Params) {
  const [socialToast, setSocialToast] = useState<string | null>(null);

  const showSocialToast = useCallback((msg: string) => {
    setSocialToast(msg);
    setTimeout(() => setSocialToast(null), 1700);
  }, []);

  const identityFeedback = useMemo(() => {
    const tag = identityState?.primary_tag;
    return {
      rescue:
        tag === "collaborative"
          ? t("dashboard.identityRescueCollaborative")
          : t("dashboard.identityRescueDefault"),
      checkin:
        tag === "consistent_creator"
          ? t("dashboard.identityCheckinConsistent")
          : t("dashboard.identityCheckinDefault"),
      session:
        tag === "locked_in"
          ? t("dashboard.identitySessionLockedIn")
          : t("dashboard.identitySessionDefault"),
    };
  }, [identityState?.primary_tag, t]);

  const runRescueNow = useCallback(() => {
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
            if (userId) {
              await applyMomentumAction(userId, "rescue");
            }
            showSocialToast(identityFeedback.rescue);
            await advancePrimaryNudge("buddy_risk");
            Alert.alert(t("dashboard.rescueSuccessTitle"), t("dashboard.rescueSuccessBody"), [
              { text: t("dashboard.later"), style: "cancel" },
              {
                text: t("dashboard.inviteProducer"),
                onPress: () => router.push("/(tabs)/friends"),
              },
            ]);
          } catch (e) {
            Alert.alert(
              t("dashboard.couldNotSendSupport"),
              e instanceof Error ? e.message : t("common.tryAgain"),
            );
          } finally {
            setSocialActionBusy(null);
          }
        },
      },
    ]);
  }, [
    token,
    buddyRisk,
    loadSocial,
    showSocialToast,
    advancePrimaryNudge,
    userId,
    identityFeedback.rescue,
    router,
    t,
    applyMomentumAction,
    setSocialActionBusy,
  ]);

  const runCheckinNow = useCallback(async () => {
    if (!token) return;
    setSocialActionBusy("checkin");
    try {
      await apiJson("/social/checkins/done", {
        token,
        method: "POST",
        body: { note: t("dashboard.quickStudioUpdateNote") },
      });
      await loadSocial();
      if (userId) {
        await applyMomentumAction(userId, "checkin");
      }
      showSocialToast(identityFeedback.checkin);
      await advancePrimaryNudge("checkin_missing");
    } catch (e) {
      Alert.alert(
        t("dashboard.couldNotLogActivity"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setSocialActionBusy(null);
    }
  }, [
    token,
    loadSocial,
    showSocialToast,
    advancePrimaryNudge,
    userId,
    identityFeedback.checkin,
    t,
    applyMomentumAction,
    setSocialActionBusy,
  ]);

  const runStartSessionNow = useCallback(
    async (category: string) => {
      if (!token) return;
      setSocialActionBusy("commitment");
      try {
        await apiJson("/sessions/quick-start", {
          token,
          method: "POST",
          body: { session_type: "beat_making" },
        });
        await loadSessions();
        if (userId) {
          await applyMomentumAction(userId, "session");
        }
        showSocialToast(identityFeedback.session);
        await advancePrimaryNudge(category);
      } catch (e) {
        Alert.alert(
          t("dashboard.couldNotStartProducing"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        setSocialActionBusy(null);
      }
    },
    [
      token,
      loadSessions,
      showSocialToast,
      advancePrimaryNudge,
      userId,
      identityFeedback.session,
      t,
      applyMomentumAction,
      setSocialActionBusy,
    ],
  );

  const runPrimaryAction = useCallback(() => {
    if (!primaryNudge) return;
    if (primaryNudge.actionKey === "rescue") {
      void runRescueNow();
      return;
    }
    if (primaryNudge.actionKey === "checkin") {
      void runCheckinNow();
      return;
    }
    if (primaryNudge.actionKey === "start_session") {
      void runStartSessionNow(primaryNudge.category);
      return;
    }
    router.push("/(tabs)/friends");
  }, [primaryNudge, runRescueNow, runCheckinNow, runStartSessionNow, router]);

  return {
    socialToast,
    runRescueNow,
    runCheckinNow,
    runStartSessionNow,
    runPrimaryAction,
  };
}
