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

import { apiJson } from "../../../lib/client";
import type { MomentumAction } from "../../../lib/momentum";
import { rescueBuddyStreak } from "../../../lib/social";
import type { BuddyRiskDto, IdentityStateDto } from "../../../types/friends";
import type { DashboardPrimaryNudge } from "./useDashboardSocialNudges";

/** Minimal navigation surface used by social actions (Expo Router–compatible). */
export type DashboardSocialRouter = {
  push: (href: Href) => void;
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
  const socialToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (socialToastTimeoutRef.current) {
        clearTimeout(socialToastTimeoutRef.current);
      }
    };
  }, []);

  const showSocialToast = useCallback((msg: string) => {
    setSocialToast(msg);
    if (socialToastTimeoutRef.current) {
      clearTimeout(socialToastTimeoutRef.current);
    }
    socialToastTimeoutRef.current = setTimeout(() => setSocialToast(null), 1700);
  }, []);

  const identityFeedback = useMemo(() => {
    const tag = identityState?.primary_tag;
    return {
      rescue:
        tag === "collaborative"
          ? t("dashboard.identityRescueCollaborative")
          : t("dashboard.identityRescueDefault"),
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
    if (primaryNudge.actionKey === "start_session") {
      void runStartSessionNow(primaryNudge.category);
      return;
    }
    router.push("/(tabs)/friends");
  }, [primaryNudge, runRescueNow, runStartSessionNow, router]);

  return {
    socialToast,
    runRescueNow,
    runStartSessionNow,
    runPrimaryAction,
  };
}
