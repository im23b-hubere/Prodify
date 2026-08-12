import {
  applyFriendsDashboardSnapshot,
  buildFeedMetrics,
  clearFriendsDashboardSnapshot,
} from "../../../features/friends/hooks/friendsDashboardState";
import type { FriendsDashboardSnapshot } from "../../../features/friends/services/friendsDashboardApi";
import type { FriendActivityDto } from "../../../types/friends";

function activity(overrides: Partial<FriendActivityDto>): FriendActivityDto {
  return {
    session_id: 1,
    reactions_count: 0,
    comments_count: 0,
    viewer_reaction: null,
    ...overrides,
  } as FriendActivityDto;
}

function dashboardWriter() {
  return {
    setLeaderboard: jest.fn(),
    setActivity: jest.fn(),
    setIncoming: jest.fn(),
    setBuddy: jest.fn(),
    setCheckin: jest.fn(),
    setChallenges: jest.fn(),
    setCommitment: jest.fn(),
    setRecap: jest.fn(),
    setFeedMetricsBySession: jest.fn(),
  };
}

describe("friends dashboard state", () => {
  it("indexes feed metrics by session and preserves viewer reactions", () => {
    expect(
      buildFeedMetrics([
        activity({
          session_id: 12,
          reactions_count: 4,
          comments_count: 2,
          viewer_reaction: "fire",
        }),
        activity({ session_id: 18, reactions_count: 1, comments_count: 3 }),
      ]),
    ).toEqual({
      12: { reactionsCount: 4, commentsCount: 2, viewerReaction: "fire" },
      18: { reactionsCount: 1, commentsCount: 3, viewerReaction: null },
    });
  });

  it("normalizes missing API counters", () => {
    expect(
      buildFeedMetrics([
        activity({
          session_id: 21,
          reactions_count: undefined,
          comments_count: undefined,
          viewer_reaction: undefined,
        }),
      ]),
    ).toEqual({
      21: { reactionsCount: 0, commentsCount: 0, viewerReaction: null },
    });
  });

  it("applies a complete API snapshot through the dashboard writer", () => {
    const writer = dashboardWriter();
    const snapshot = {
      leaderboard: { period: "week", entries: [] },
      activity: [activity({ session_id: 7, reactions_count: 2 })],
      incoming: [],
      buddy: null,
      checkin: null,
      challenges: [],
      commitment: null,
      recap: null,
    } as FriendsDashboardSnapshot;

    applyFriendsDashboardSnapshot(writer, snapshot);

    expect(writer.setLeaderboard).toHaveBeenCalledWith(snapshot.leaderboard);
    expect(writer.setActivity).toHaveBeenCalledWith(snapshot.activity);
    expect(writer.setFeedMetricsBySession).toHaveBeenCalledWith({
      7: { reactionsCount: 2, commentsCount: 0, viewerReaction: null },
    });
  });

  it("clears stale optional data after a failed load", () => {
    const writer = dashboardWriter();

    clearFriendsDashboardSnapshot(writer);

    expect(writer.setActivity).toHaveBeenCalledWith([]);
    expect(writer.setBuddy).toHaveBeenCalledWith(null);
    expect(writer.setRecap).toHaveBeenCalledWith(null);
    expect(writer.setFeedMetricsBySession).toHaveBeenCalledWith({});
  });
});
