import type { TFunction } from "i18next";
import { waitFor } from "@testing-library/react-native";

import { buildFriendsTriggerCards } from "../../../features/friends/hooks/useFriendsTriggerCards";
import type { FriendsScreenState } from "../../../features/friends/hooks/useFriendsScreenState";
import { apiJson } from "../../../lib/client";
import { recordMomentumAction } from "../../../lib/momentum";
import type { SocialChallengeDto } from "../../../types/friends";

jest.mock("../../../lib/client", () => ({ apiJson: jest.fn().mockResolvedValue({}) }));
jest.mock("../../../lib/momentum", () => ({
  recordMomentumAction: jest.fn().mockResolvedValue(undefined),
}));

const t = ((key: string) => key) as unknown as TFunction;

const challenge = {
  id: 1,
  owner_id: 2,
  challenge_kind: "duel",
  title: "Close race",
  week_start: "2026-08-10",
  target_sessions: 5,
  status: "active",
  members: [
    { user_id: 1, username: "Me", progress_sessions: 3 },
    { user_id: 2, username: "Mia", progress_sessions: 4 },
  ],
} satisfies SocialChallengeDto;

function context() {
  const state = {
    buddy: {
      status: "active",
      buddy_user_id: 2,
      this_week_sessions: 2,
      buddy_week_sessions: 3,
    },
    activity: [
      {
        session_id: 9,
        user_id: 2,
        username: "Mia",
        session_type: "writing",
        activity_at: "now",
        status: "live",
      },
    ],
    showToast: jest.fn(),
  } as unknown as FriendsScreenState;
  return {
    token: "token",
    userId: 1,
    t,
    load: jest.fn().mockResolvedValue(undefined),
    state,
    challengeCards: [challenge],
    openSession: jest.fn(),
    openSessionSetup: jest.fn(),
  };
}

describe("friends trigger cards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("derives ordered cards and routes their immediate actions", () => {
    const input = context();
    const cards = buildFriendsTriggerCards(input);

    expect(cards.map(({ key }) => key)).toEqual(["buddy_completed", "close_battle", "streak_risk"]);
    cards[0].onPress();
    cards[1].onPress();

    expect(input.openSessionSetup).toHaveBeenCalledTimes(1);
    expect(input.openSession).toHaveBeenCalledWith(9, "Mia");
    expect(recordMomentumAction).toHaveBeenCalledWith(1, "social");
  });

  it("rescues the active buddy and refreshes the dashboard", async () => {
    const input = context();
    buildFriendsTriggerCards(input)[2].onPress();

    await waitFor(() =>
      expect(apiJson).toHaveBeenCalledWith("/social/streak/rescue", {
        token: "token",
        method: "POST",
        body: { rescued_user_id: 2 },
      }),
    );
    await waitFor(() => expect(input.load).toHaveBeenCalledWith({ force: true }));
  });
});
