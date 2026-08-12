import type { FriendActivityDto } from "../../../types/friends";
import type { FriendsDashboardSnapshot } from "../services/friendsDashboardApi";
import type { FriendsScreenState } from "./useFriendsScreenState";

type FeedMetrics = FriendsScreenState["feedMetricsBySession"];
export type FriendsDashboardWriter = Pick<
  FriendsScreenState,
  | "setLeaderboard"
  | "setActivity"
  | "setIncoming"
  | "setBuddy"
  | "setCheckin"
  | "setChallenges"
  | "setCommitment"
  | "setRecap"
  | "setFeedMetricsBySession"
>;

export function buildFeedMetrics(activity: FriendActivityDto[]): FeedMetrics {
  return Object.fromEntries(
    activity.map((item) => [
      item.session_id,
      {
        reactionsCount: item.reactions_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        viewerReaction: item.viewer_reaction ?? null,
      },
    ]),
  );
}

export function applyFriendsDashboardSnapshot(
  state: FriendsDashboardWriter,
  snapshot: FriendsDashboardSnapshot,
) {
  state.setLeaderboard(snapshot.leaderboard);
  state.setActivity(snapshot.activity);
  state.setIncoming(snapshot.incoming);
  state.setBuddy(snapshot.buddy);
  state.setCheckin(snapshot.checkin);
  state.setChallenges(snapshot.challenges);
  state.setCommitment(snapshot.commitment);
  state.setRecap(snapshot.recap);
  state.setFeedMetricsBySession(buildFeedMetrics(snapshot.activity));
}

export function clearFriendsDashboardSnapshot(state: FriendsDashboardWriter) {
  state.setActivity([]);
  state.setIncoming([]);
  state.setBuddy(null);
  state.setCheckin(null);
  state.setChallenges([]);
  state.setCommitment(null);
  state.setRecap(null);
  state.setFeedMetricsBySession({});
}
