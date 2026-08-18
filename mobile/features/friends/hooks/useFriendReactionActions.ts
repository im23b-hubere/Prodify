import { useCallback } from "react";
import { Alert } from "react-native";

import { fetchSessionReactionUsers, toggleSessionReaction } from "../../../lib/social";
import type { FriendActivityDto } from "../../../types/friends";
import type { FriendActionContext } from "./friendEngagementTypes";

export function useFriendReactionActions(context: FriendActionContext) {
  return {
    openReactionUsers: useOpenReactionUsers(context),
    toggleThumbReaction: useToggleThumbReaction(context),
  };
}

function useOpenReactionUsers({ state, t, token }: FriendActionContext) {
  return useCallback(
    async (sessionId: number) => {
      if (!token) return;
      state.setReactionUsersOpen(true);
      state.setReactionUsersLoading(true);
      try {
        state.setReactionUsers(await fetchSessionReactionUsers(token, sessionId));
      } catch (error) {
        state.setReactionUsers([]);
        showReactionError(t, error);
      } finally {
        state.setReactionUsersLoading(false);
      }
    },
    [state, t, token],
  );
}

function useToggleThumbReaction({ state, t, token }: FriendActionContext) {
  return useCallback(
    async (item: FriendActivityDto) => {
      if (!token || state.reactionBusyBySession[item.session_id]) return;
      const sessionId = item.session_id;
      const previous = state.feedMetricsBySession[sessionId] ?? {
        reactionsCount: item.reactions_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        viewerReaction: item.viewer_reaction ?? null,
      };
      const hadThumb = previous.viewerReaction === "👍";
      state.setFeedMetricsBySession((current) => ({
        ...current,
        [sessionId]: {
          ...previous,
          viewerReaction: hadThumb ? null : "👍",
          reactionsCount: Math.max(0, previous.reactionsCount + (hadThumb ? -1 : 1)),
        },
      }));
      state.setReactionBusyBySession((current) => ({ ...current, [sessionId]: true }));
      try {
        const updated = await toggleSessionReaction(token, sessionId, "👍");
        const reactionsCount = updated.reduce((sum, row) => sum + row.count, 0);
        const reacted = updated.some((row) => row.emoji === "👍" && row.reacted_by_me);
        state.setFeedMetricsBySession((current) => ({
          ...current,
          [sessionId]: {
            reactionsCount,
            commentsCount: current[sessionId]?.commentsCount ?? previous.commentsCount,
            viewerReaction: reacted ? "👍" : null,
          },
        }));
      } catch (error) {
        state.setFeedMetricsBySession((current) => ({ ...current, [sessionId]: previous }));
        showReactionError(t, error);
      } finally {
        state.setReactionBusyBySession((current) => ({ ...current, [sessionId]: false }));
      }
    },
    [state, t, token],
  );
}

function showReactionError(t: FriendActionContext["t"], error: unknown) {
  Alert.alert(
    t("friendsScreen.errorGeneric"),
    error instanceof Error ? error.message : t("common.tryAgain"),
  );
}
