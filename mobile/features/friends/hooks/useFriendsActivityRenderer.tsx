import type { TFunction } from "i18next";
import { useCallback } from "react";

import type { FriendActivityDto } from "../../../types/friends";
import { FriendsActivityFeedItem } from "../components/FriendsActivityFeedItem";
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

function runWhen(condition: boolean, action: () => void) {
  return () => {
    if (condition) action();
  };
}

function activityMetrics(
  item: FriendActivityDto,
  feedMetrics: FriendsScreenState["feedMetricsBySession"],
  reactionBusy: FriendsScreenState["reactionBusyBySession"],
) {
  const metrics = feedMetrics[item.session_id];
  return {
    reactionTotal: metrics?.reactionsCount ?? item.reactions_count ?? 0,
    commentCount: metrics?.commentsCount ?? item.comments_count ?? 0,
    reactedByMe: metrics?.viewerReaction === "👍",
    reactionBusy: Boolean(reactionBusy[item.session_id]),
  };
}

function activityHandlers(
  item: FriendActivityDto,
  options: Pick<
    ActivityRendererOptions,
    "actions" | "openSession" | "openStatsYourWeek" | "userId"
  >,
) {
  const { actions, openSession, openStatsYourWeek, userId } = options;
  const isSessionItem =
    item.session_id > 0 && (item.status === "live" || item.status === "completed");
  return {
    onOpenSession: runWhen(isSessionItem, () => openSession(item.session_id, item.username)),
    onToggleThumb: runWhen(isSessionItem, () => void actions.toggleThumbReaction(item)),
    onOpenReactionUsers: runWhen(
      isSessionItem,
      () => void actions.openReactionUsers(item.session_id),
    ),
    onSupportStreakBreak: runWhen(
      item.status === "streak_broken" && item.user_id !== userId,
      () => void actions.supportStreakBreak(item),
    ),
    onViewCommitment: runWhen(item.status === "commitment_published", openStatsYourWeek),
  };
}

export function useFriendsActivityRenderer({
  actions,
  state,
  userId,
  t,
  openSession,
  openStatsYourWeek,
}: ActivityRendererOptions) {
  const { busyActionKey, feedMetricsBySession, reactionBusyBySession } = state;
  return useCallback(
    (item: FriendActivityDto, index: number) => {
      const metrics = activityMetrics(item, feedMetricsBySession, reactionBusyBySession);
      const handlers = activityHandlers(item, {
        actions,
        openSession,
        openStatsYourWeek,
        userId,
      });
      return (
        <FriendsActivityFeedItem
          item={item}
          index={index}
          {...metrics}
          {...handlers}
          currentUserId={userId}
          t={t}
          supportBusy={
            item.status === "streak_broken" &&
            item.user_id !== userId &&
            busyActionKey === "streak_support"
          }
        />
      );
    },
    [
      actions,
      busyActionKey,
      feedMetricsBySession,
      openSession,
      openStatsYourWeek,
      reactionBusyBySession,
      t,
      userId,
    ],
  );
}
