import {
  ACTIVITY_PREVIEW_SIZE,
  activityKind,
  groupActivityByDay,
  liveFriends,
  pastActivity,
  previewActivity,
} from "../../../features/friends/activity/friendsActivityFeed";
import type { FriendActivityDto } from "../../../types/friends";

const NOW = new Date(2026, 8, 30, 20, 0).getTime();

function activity(overrides: Partial<FriendActivityDto> = {}): FriendActivityDto {
  return {
    session_id: 1,
    user_id: 2,
    username: "bob",
    session_type: "beat_making",
    activity_at: new Date(NOW).toISOString(),
    status: "completed",
    ...overrides,
  };
}

describe("liveFriends", () => {
  it("lists each live friend once", () => {
    const live = liveFriends([
      activity({ session_id: 5, status: "live" }),
      activity({ session_id: 4, status: "live" }),
      activity({ session_id: 3, user_id: 3, status: "live" }),
    ]);
    expect(live.map((item) => item.session_id)).toEqual([5, 3]);
  });

  it("ignores finished sessions and live entries without a session", () => {
    expect(liveFriends([activity(), activity({ session_id: 0, status: "live" })])).toEqual([]);
  });
});

describe("pastActivity", () => {
  it("drops running sessions", () => {
    const feed = pastActivity([activity({ status: "live" }), activity({ session_id: 2 })]);
    expect(feed.map((item) => item.session_id)).toEqual([2]);
  });
});

describe("activityKind", () => {
  it("tells sessions apart from streak and commitment events", () => {
    expect(activityKind(activity())).toBe("session");
    expect(activityKind(activity({ status: "streak_broken" }))).toBe("streak_broken");
    expect(activityKind(activity({ status: "commitment_published" }))).toBe("commitment");
  });
});

describe("previewActivity", () => {
  const many = Array.from({ length: ACTIVITY_PREVIEW_SIZE + 3 }, (_, index) =>
    activity({ session_id: index + 1 }),
  );

  it("caps the collapsed feed and reports what is hidden", () => {
    const { items, hiddenCount } = previewActivity(many, false);
    expect(items).toHaveLength(ACTIVITY_PREVIEW_SIZE);
    expect(hiddenCount).toBe(3);
  });

  it("shows everything when expanded", () => {
    expect(previewActivity(many, true)).toEqual({ items: many, hiddenCount: 0 });
  });
});

describe("groupActivityByDay", () => {
  it("groups by local calendar day and counts days back from today", () => {
    const days = groupActivityByDay(
      [
        activity({ session_id: 1, activity_at: new Date(2026, 8, 30, 9, 0).toISOString() }),
        activity({ session_id: 2, activity_at: new Date(2026, 8, 30, 0, 5).toISOString() }),
        activity({ session_id: 3, activity_at: new Date(2026, 8, 29, 23, 55).toISOString() }),
        activity({ session_id: 4, activity_at: new Date(2026, 8, 25, 12, 0).toISOString() }),
      ],
      NOW,
    );
    expect(days.map((day) => day.daysAgo)).toEqual([0, 1, 5]);
    expect(days[0].items.map((item) => item.session_id)).toEqual([1, 2]);
  });

  it("skips entries without a valid date", () => {
    expect(groupActivityByDay([activity({ activity_at: "not a date" })], NOW)).toEqual([]);
  });
});
