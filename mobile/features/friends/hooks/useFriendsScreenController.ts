import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import type { RematchRequest } from "../../challenges/board/duelBoard";
import { subscribeChallengeSync } from "../../challenges/sync/challengeSync";
import { liveFriends, pastActivity } from "../activity/friendsActivityFeed";
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
  const { addFriend } = useLocalSearchParams<{ addFriend?: string }>();
  const { setAddOpen } = state;
  useEffect(() => {
    if (addFriend !== "1") return;
    setAddOpen(true);
    router.setParams({ addFriend: undefined });
  }, [addFriend, router, setAddOpen]);
  const periodParam = state.mode === "week" ? "week" : "all";
  const { load, onRefresh } = useFriendsDashboardData({
    token,
    userId: user?.id,
    periodParam,
    t,
    state,
  });

  const openProfile = useCallback(
    (profileUserId: number) => router.push(`/profile/${profileUserId}` as Href),
    [router],
  );
  const openSession = useCallback(
    (sessionId: number, ownerName: string, focus?: "comments") => {
      router.push({
        pathname: "/session/[id]",
        params: { id: String(sessionId), ownerName, ...(focus ? { focus } : {}) },
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
  });
  const friendActivity = useMemo(
    () => state.activity.filter((item) => item.user_id !== user?.id),
    [state.activity, user?.id],
  );
  const liveActivity = useMemo(() => liveFriends(friendActivity), [friendActivity]);
  const feedActivity = useMemo(() => pastActivity(friendActivity), [friendActivity]);
  useFriendsNotifications(state.incoming, state.activity, user?.id, t);

  const renderActivity = useFriendsActivityRenderer({
    actions,
    state,
    userId: user?.id,
    t,
    openSession,
    openProfile,
  });
  const openChallengeCreate = useCallback(() => router.push("/challenge/new" as Href), [router]);
  const challengeFriend = useCallback(
    (friendId: number) =>
      router.push({ pathname: "/challenge/new", params: { friendId: String(friendId) } } as Href),
    [router],
  );
  const rematchDuel = useCallback(
    ({ friendId, targetSessions, durationDays }: RematchRequest) =>
      router.push({
        pathname: "/challenge/new",
        params: {
          friendId: String(friendId),
          target: String(targetSessions),
          days: String(durationDays),
        },
      } as Href),
    [router],
  );
  const openChallenge = useCallback(
    (challengeId: number) => router.push(`/challenge/${challengeId}` as Href),
    [router],
  );
  useEffect(
    () =>
      subscribeChallengeSync((reason) => {
        void load({ force: reason === "changed" }).catch(() => undefined);
      }),
    [load],
  );

  return {
    t,
    userId: user?.id,
    state,
    actions,
    load,
    onRefresh,
    liveActivity,
    feedActivity,
    renderActivity,
    openSessionSetup,
    openChallengeCreate,
    challengeFriend,
    rematchDuel,
    openProfile,
    openChallenge,
  };
}

export type FriendsScreenController = ReturnType<typeof useFriendsScreenController>;
