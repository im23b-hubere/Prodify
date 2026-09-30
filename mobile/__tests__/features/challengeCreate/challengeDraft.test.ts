import {
  CHALLENGE_LIMITS,
  challengeDraftReducer,
  challengeStepIssue,
  createChallengeDraft,
  duelCreateRequest,
  friendDuelStatus,
  parseRematchGoal,
  generatedChallengeTitle,
  matchingPresetId,
  resolvedChallengeTitle,
  stepperBounds,
  weeklyPace,
  type ChallengeDraft,
  type ChallengeDraftAction,
} from "../../../features/challengeCreate/challengeDraft";
import type { SocialChallengeDto } from "../../../types/friends";

function apply(draft: ChallengeDraft, ...actions: ChallengeDraftAction[]) {
  return actions.reduce(challengeDraftReducer, draft);
}

function duel(overrides: Partial<SocialChallengeDto>): SocialChallengeDto {
  return {
    id: 1,
    owner_id: 1,
    title: "Duel",
    challenge_kind: "duel",
    week_start: "2026-09-28",
    target_sessions: 5,
    status: "active",
    members: [],
    ...overrides,
  };
}

describe("createChallengeDraft", () => {
  it("starts on the friend step with the classic preset", () => {
    const draft = createChallengeDraft();
    expect(draft.step).toBe("friend");
    expect(matchingPresetId(draft)).toBe("classic");
  });

  it("skips the friend step when a friend is preselected", () => {
    const draft = createChallengeDraft({ friendId: 7 });
    expect(draft.step).toBe("goal");
    expect(draft.friendId).toBe(7);
  });

  it("opens a rematch on the review step with the previous goal", () => {
    const draft = createChallengeDraft({
      friendId: 7,
      rematchGoal: { targetSessions: 8, durationDays: 14 },
    });
    expect(draft.step).toBe("review");
    expect([draft.targetSessions, draft.durationDays]).toEqual([8, 14]);
  });

  it("clamps a rematch goal into the backend limits", () => {
    const draft = createChallengeDraft({
      friendId: 7,
      rematchGoal: { targetSessions: 99, durationDays: 1 },
    });
    expect([draft.targetSessions, draft.durationDays]).toEqual([
      CHALLENGE_LIMITS.maxTargetSessions,
      CHALLENGE_LIMITS.minDurationDays,
    ]);
  });
});

describe("parseRematchGoal", () => {
  it("reads both numbers from route params", () => {
    expect(parseRematchGoal("8", "14")).toEqual({ targetSessions: 8, durationDays: 14 });
  });

  it("ignores missing or malformed params", () => {
    expect(parseRematchGoal(undefined, "7")).toBeNull();
    expect(parseRematchGoal("abc", "7")).toBeNull();
    expect(parseRematchGoal("0", "7")).toBeNull();
  });
});

describe("presets", () => {
  it("applies an available preset", () => {
    const draft = apply(createChallengeDraft(), { type: "choosePreset", presetId: "warmup" });
    expect([draft.targetSessions, draft.durationDays]).toEqual([3, 3]);
  });

  it("reports no preset once the numbers are tuned by hand", () => {
    const draft = apply(createChallengeDraft(), { type: "stepTarget", delta: 1 });
    expect(matchingPresetId(draft)).toBeNull();
  });
});

describe("steppers", () => {
  it("never goes below the minimum target or duration", () => {
    const draft = apply(
      createChallengeDraft(),
      { type: "stepTarget", delta: -99 },
      { type: "stepDuration", delta: -99 },
    );
    expect(draft.targetSessions).toBe(CHALLENGE_LIMITS.minTargetSessions);
    expect(draft.durationDays).toBe(CHALLENGE_LIMITS.minDurationDays);
  });

  it("never goes above the backend maximum and disables the plus buttons there", () => {
    const draft = apply(
      createChallengeDraft(),
      { type: "stepTarget", delta: 99 },
      { type: "stepDuration", delta: 99 },
    );
    expect(draft.targetSessions).toBe(CHALLENGE_LIMITS.maxTargetSessions);
    expect(draft.durationDays).toBe(CHALLENGE_LIMITS.maxDurationDays);
    expect(stepperBounds(draft)).toMatchObject({
      canIncreaseTarget: false,
      canIncreaseDuration: false,
    });
  });
});

describe("weeklyPace", () => {
  it("expresses the goal as sessions per week", () => {
    expect(weeklyPace(createChallengeDraft())).toBe(5);
    expect(
      weeklyPace(apply(createChallengeDraft(), { type: "choosePreset", presetId: "warmup" })),
    ).toBe(7);
  });
});

describe("step navigation", () => {
  it("moves forward and back within the three steps", () => {
    const start = createChallengeDraft();
    expect(apply(start, { type: "next" }).step).toBe("goal");
    expect(apply(start, { type: "next" }, { type: "next" }, { type: "next" }).step).toBe("review");
    expect(apply(start, { type: "back" })).toBe(start);
  });
});

describe("friendDuelStatus", () => {
  const userId = 1;
  const friendId = 2;

  it("blocks a friend with an open invite in either direction", () => {
    const outgoing = duel({ status: "pending", owner_id: userId, invitee_user_id: friendId });
    const incoming = duel({ status: "pending", owner_id: friendId, invitee_user_id: userId });
    expect(friendDuelStatus(friendId, [outgoing], userId)).toBe("invite_pending");
    expect(friendDuelStatus(friendId, [incoming], userId)).toBe("invite_pending");
  });

  it("marks a running duel without blocking", () => {
    const running = duel({
      members: [
        { user_id: userId, username: "me", progress_sessions: 0 },
        { user_id: friendId, username: "bob", progress_sessions: 0 },
      ],
    });
    expect(friendDuelStatus(friendId, [running], userId)).toBe("in_duel");
  });

  it("ignores invites between other people and non-duel challenges", () => {
    const others = duel({ status: "pending", owner_id: 3, invitee_user_id: friendId });
    const team = duel({
      challenge_kind: "team",
      status: "pending",
      owner_id: userId,
      invitee_user_id: friendId,
    });
    expect(friendDuelStatus(friendId, [others, team], userId)).toBe("available");
  });
});

describe("titles", () => {
  it("generates a versus title and keeps it within the backend limit", () => {
    expect(generatedChallengeTitle("eric", "bob")).toBe("eric vs bob");
    expect(generatedChallengeTitle("a".repeat(100), "b".repeat(100))).toHaveLength(
      CHALLENGE_LIMITS.maxTitleLength,
    );
  });

  it("prefers a custom title and falls back when it is blank", () => {
    const custom = apply(createChallengeDraft(), { type: "editTitle", title: "  Beat week  " });
    expect(resolvedChallengeTitle(custom, "eric", "bob")).toBe("Beat week");
    const blank = apply(createChallengeDraft(), { type: "editTitle", title: "   " });
    expect(resolvedChallengeTitle(blank, "eric", "bob")).toBe("eric vs bob");
  });
});

describe("challengeStepIssue", () => {
  it("requires a friend before leaving the friend step", () => {
    const draft = createChallengeDraft();
    expect(challengeStepIssue(draft, "friend", { friendStatus: null, title: "" })).toBe(
      "pick_friend",
    );
  });

  it("refuses a friend that already has an open invite", () => {
    const draft = createChallengeDraft({ friendId: 2 });
    expect(challengeStepIssue(draft, "friend", { friendStatus: "invite_pending", title: "" })).toBe(
      "invite_pending",
    );
  });

  it("keeps blocking later steps when a preselected friend already has an open invite", () => {
    const draft = createChallengeDraft({ friendId: 2 });
    expect(
      challengeStepIssue(draft, "goal", { friendStatus: "invite_pending", title: "eric vs bob" }),
    ).toBe("invite_pending");
  });

  it("treats a preselected user outside the friend list as no friend", () => {
    const draft = createChallengeDraft({ friendId: 99 });
    expect(challengeStepIssue(draft, "goal", { friendStatus: null, title: "" })).toBe(
      "pick_friend",
    );
  });

  it("rejects a title the backend would refuse", () => {
    const draft = createChallengeDraft({ friendId: 2 });
    expect(challengeStepIssue(draft, "review", { friendStatus: "available", title: "ab" })).toBe(
      "title_too_short",
    );
    expect(
      challengeStepIssue(draft, "review", { friendStatus: "available", title: "eric vs bob" }),
    ).toBeNull();
  });
});

describe("duelCreateRequest", () => {
  it("builds a duel request for the selected friend", () => {
    const draft = createChallengeDraft({ friendId: 2 });
    expect(duelCreateRequest(draft, "eric vs bob")).toEqual({
      challenge_kind: "duel",
      title: "eric vs bob",
      target_sessions: 5,
      duration_days: 7,
      member_user_ids: [2],
    });
  });

  it("returns nothing without a friend", () => {
    expect(duelCreateRequest(createChallengeDraft(), "eric vs bob")).toBeNull();
  });
});
