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
  | "setDuelRecords"
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

function applyIfLoaded<T>(value: T | undefined, setter: (next: T) => void) {
  if (value !== undefined) setter(value);
}

/** Optional parts that failed to load arrive as `undefined` and keep what the screen already shows. */
export function applyFriendsDashboardSnapshot(
  state: FriendsDashboardWriter,
  snapshot: FriendsDashboardSnapshot,
) {
  state.setLeaderboard(snapshot.leaderboard);
  state.setActivity(snapshot.activity);
  state.setIncoming(snapshot.incoming);
  applyIfLoaded(snapshot.buddy, state.setBuddy);
  applyIfLoaded(snapshot.checkin, state.setCheckin);
  applyIfLoaded(snapshot.challenges, state.setChallenges);
  applyIfLoaded(snapshot.duelRecords, state.setDuelRecords);
  applyIfLoaded(snapshot.commitment, state.setCommitment);
  applyIfLoaded(snapshot.recap, state.setRecap);
  state.setFeedMetricsBySession(buildFeedMetrics(snapshot.activity));
}
