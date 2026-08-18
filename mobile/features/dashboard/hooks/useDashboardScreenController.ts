import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { useRankProgression } from "../../../hooks/useRankProgression";
import { useDashboardData } from "./useDashboardData";
import { useDashboardLifecycle } from "./useDashboardLifecycle";
import { useDashboardPresentation } from "./useDashboardPresentation";
import { useDashboardSessionActions } from "./useDashboardSessionActions";
import { useDashboardSessionSetupModal } from "./useDashboardSessionSetupModal";
import { useDashboardSessionSetupResults } from "./useDashboardSessionSetupResults";
import { useDashboardSocialActions } from "./useDashboardSocialActions";
import { useDashboardSocialNudges } from "./useDashboardSocialNudges";
import { useDashboardStreakEvents } from "./useDashboardStreakEvents";

type DashboardData = ReturnType<typeof useDashboardData>;
type SessionSetup = ReturnType<typeof useDashboardSessionSetupModal>;

export function useDashboardScreenController() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { level } = useRankProgression(Boolean(token));
  const router = useRouter();
  const data = useDashboardData(token);
  const setup = useDashboardSessionSetupModal();
  const presentation = useDashboardPresentation({
    sessions: data.sessions,
    streakOverview: data.streakOverview,
    loading: data.loading,
    weeklyGoalTarget: data.weeklyGoalTarget,
    hasWeeklyGoal: data.hasWeeklyGoal,
    weekSessionsCount: data.weekSessionsCount,
    accountCreatedAtIso: user?.created_at,
    lastUpdated: data.lastUpdated,
    t,
  });
  const sessionActions = useDashboardSessionActions({
    token,
    active: data.active,
    suggestedSessionType: presentation.todayPlan.suggestedSessionType,
    displayOverview: presentation.displayOverview,
    t,
    setActive: data.setActive,
    setError: data.setError,
    setRefreshing: data.setRefreshing,
    loadSessions: data.loadSessions,
    loadStreakOverview: data.loadStreakOverview,
    refreshDashboard: data.refreshDashboard,
  });
  const [socialActionBusy, setSocialActionBusy] = useState<string | null>(null);
  const social = useDashboardSocialController({
    token,
    userId: user?.id,
    router,
    t,
    data,
    setSocialActionBusy,
  });
  const experience = useDashboardExperienceController({ token, userId: user?.id, t, data, setup });
  return {
    t,
    user,
    level,
    router,
    data,
    setup,
    presentation,
    sessionActions,
    social,
    experience,
    socialActionBusy,
  };
}

export type DashboardScreenController = ReturnType<typeof useDashboardScreenController>;

function useDashboardSocialController({
  token,
  userId,
  router,
  t,
  data,
  setSocialActionBusy,
}: {
  token: string | null;
  userId?: number;
  router: ReturnType<typeof useRouter>;
  t: TFunction;
  data: DashboardData;
  setSocialActionBusy: Dispatch<SetStateAction<string | null>>;
}) {
  const nudges = useDashboardSocialNudges({
    userId,
    friendActivity: data.friendActivity,
    buddyRisk: data.buddyRisk,
    socialChallenges: data.socialChallenges,
    commitmentStatus: data.commitmentStatus,
    checkinStatus: data.checkinStatus,
    t,
  });
  const actions = useDashboardSocialActions({
    token,
    userId,
    buddyRisk: data.buddyRisk,
    primaryNudge: nudges.primaryNudge,
    identityState: data.identityState,
    router,
    t,
    loadSocial: data.loadSocial,
    advancePrimaryNudge: nudges.advancePrimaryNudge,
    applyMomentumAction: nudges.applyMomentumAction,
    setSocialActionBusy,
  });
  return { ...nudges, ...actions };
}

function useDashboardExperienceController({
  token,
  userId,
  t,
  data,
  setup,
}: {
  token: string | null;
  userId?: number;
  t: TFunction;
  data: DashboardData;
  setup: SessionSetup;
}) {
  const router = useRouter();
  const lifecycle = useDashboardLifecycle({
    token,
    userId,
    refreshDashboard: data.refreshDashboard,
    presentSessionSetup: setup.presentSessionSetupModalFresh,
  });
  const streak = useDashboardStreakEvents({
    userId,
    streakOverview: data.streakOverview,
    userScopedMilestoneKey: lifecycle.userScopedMilestoneKey,
    userScopedStreakKey: lifecycle.userScopedStreakKey,
    t,
    refreshUnread: lifecycle.refreshUnreadCount,
  });
  const openSetupScreen = useCallback(() => router.push("/session/setup"), [router]);
  const setupResults = useDashboardSessionSetupResults({
    closeSetupModal: setup.closeSetupModal,
    openSetupScreen,
    loadSessions: data.loadSessions,
    loadStreakOverview: data.loadStreakOverview,
    setActive: data.setActive,
    setSessions: data.setSessions,
    setError: data.setError,
    t,
  });
  return { ...lifecycle, ...streak, ...setupResults };
}
