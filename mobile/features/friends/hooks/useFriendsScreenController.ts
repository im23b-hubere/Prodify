import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { useFriendsActivityRenderer } from "./useFriendsActivityRenderer";
import { useFriendsDashboardData } from "./useFriendsDashboardData";
import { useFriendsNotifications } from "./useFriendsNotifications";
import { useFriendsScreenActions } from "./useFriendsScreenActions";
import { useFriendsScreenState } from "./useFriendsScreenState";

export function useFriendsScreenController() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const state = useFriendsScreenState();
  const periodParam = state.mode === "week" ? "week" : "all";
  const { load, onRefresh } = useFriendsDashboardData({
    token,
    userId: user?.id,
    periodParam,
    t,
    state,
  });

  const openStatsYourWeek = useCallback(() => {
    router.push({ pathname: "/(tabs)/stats", params: { focus: "yourWeek" } } as Href);
  }, [router]);
  const openSession = useCallback(
    (sessionId: number, ownerName: string) => {
      router.push({
        pathname: "/session/[id]",
        params: { id: String(sessionId), ownerName },
      } as Href);
    },
    [router],
  );
  const openSessionSetup = useCallback(() => router.push("/session/setup" as Href), [router]);
  const actions = useFriendsScreenActions({
    token,
    userId: user?.id,
    t,
    load,
    state,
    openSession,
    openSessionSetup,
  });
  const visibleActivity = useMemo(
    () => state.activity.filter((item) => item.user_id !== user?.id),
    [state.activity, user?.id],
  );
  useFriendsNotifications(state.incoming, state.activity, user?.id, t);

  const renderActivity = useFriendsActivityRenderer({
    actions,
    state,
    userId: user?.id,
    t,
    openSession,
    openStatsYourWeek,
  });
  const {
    setChallengeKind,
    setChallengeTarget,
    setChallengeDuration,
    setChallengeTitle,
    setSelectedMembers,
    setChallengeCreateOpen,
  } = state;
  const openChallengeCreate = useCallback(() => {
    setChallengeKind("duel");
    setChallengeTarget("5");
    setChallengeDuration("7");
    setChallengeTitle("");
    setSelectedMembers([]);
    setChallengeCreateOpen(true);
  }, [
    setChallengeCreateOpen,
    setChallengeDuration,
    setChallengeKind,
    setChallengeTarget,
    setChallengeTitle,
    setSelectedMembers,
  ]);

  return {
    t,
    userId: user?.id,
    state,
    actions,
    load,
    onRefresh,
    visibleActivity,
    renderActivity,
    openSessionSetup,
    openChallengeCreate,
  };
}

export type FriendsScreenController = ReturnType<typeof useFriendsScreenController>;
