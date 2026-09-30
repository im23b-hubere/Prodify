import type { TFunction } from "i18next";
import { type ReactNode, useCallback } from "react";

import type { FriendActivityDto } from "../../../types/friends";
import { ActivityEventRow } from "../activity/components/ActivityEventRow";
import { ActivitySessionRow } from "../activity/components/ActivitySessionRow";
import { activityKind, isOpenableSession } from "../activity/friendsActivityFeed";
import type { FriendsScreenActions } from "./useFriendsScreenActions";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActivityRendererOptions = {
  actions: FriendsScreenActions;
  state: FriendsScreenState;
  userId?: number;
  t: TFunction;
  openSession: (sessionId: number, ownerName: string) => void;
  openStatsYourWeek: () => void;
};

export type RenderActivity = (item: FriendActivityDto, divided: boolean) => ReactNode;

export function useFriendsActivityRenderer({
  actions,
  state,
  userId,
  t,
  openSession,
  openStatsYourWeek,
}: ActivityRendererOptions): RenderActivity {
  const { busyActionKey, feedMetricsBySession, reactionBusyBySession } = state;
  const { toggleThumbReaction, openReactionUsers, supportStreakBreak } = actions;

  const openActivitySession = useCallback(
    (item: FriendActivityDto) => {
      if (isOpenableSession(item)) openSession(item.session_id, item.username);
    },
    [openSession],
  );
  const toggleThumb = useCallback(
    (item: FriendActivityDto) => {
      if (isOpenableSession(item)) void toggleThumbReaction(item);
    },
    [toggleThumbReaction],
  );
  const showReactionUsers = useCallback(
    (item: FriendActivityDto) => {
      if (isOpenableSession(item)) void openReactionUsers(item.session_id);
    },
    [openReactionUsers],
  );
  const supportFriend = useCallback(
    (item: FriendActivityDto) => void supportStreakBreak(item),
    [supportStreakBreak],
  );

  return useCallback(
    (item: FriendActivityDto, divided: boolean) => {
      const kind = activityKind(item);
      if (kind !== "session") {
        const isOwnStreakBreak = kind === "streak_broken" && item.user_id === userId;
        return (
          <ActivityEventRow
            t={t}
            item={item}
            kind={kind}
            divided={divided}
            canAct={!isOwnStreakBreak}
            actionBusy={kind === "streak_broken" && busyActionKey === "streak_support"}
            onSupportStreakBreak={supportFriend}
            onViewCommitment={openStatsYourWeek}
          />
        );
      }
      const metrics = feedMetricsBySession[item.session_id];
      return (
        <ActivitySessionRow
          t={t}
          item={item}
          divided={divided}
          reactionTotal={metrics?.reactionsCount ?? item.reactions_count ?? 0}
          commentCount={metrics?.commentsCount ?? item.comments_count ?? 0}
          reactedByMe={metrics?.viewerReaction === "👍"}
          reactionBusy={Boolean(reactionBusyBySession[item.session_id])}
          onOpenSession={openActivitySession}
          onToggleThumb={toggleThumb}
          onOpenReactionUsers={showReactionUsers}
        />
      );
    },
    [
      busyActionKey,
      feedMetricsBySession,
      openActivitySession,
      openStatsYourWeek,
      reactionBusyBySession,
      showReactionUsers,
      supportFriend,
      t,
      toggleThumb,
      userId,
    ],
  );
}
