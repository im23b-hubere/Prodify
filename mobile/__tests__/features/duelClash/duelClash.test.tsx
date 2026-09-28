import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { DuelClashOverlay } from "../../../features/duelClash/components/DuelClashOverlay";
import { duelClashPayload, isAcceptedOwnedDuel } from "../../../features/duelClash/duelClashPayload";
import { loadSeenDuelClashIds, markDuelClashSeen } from "../../../features/duelClash/duelClashSeen";
import {
  clearDuelClashQueue,
  dismissCurrentDuelClash,
  showDuelClash,
  useCurrentDuelClash,
} from "../../../features/duelClash/duelClashStore";
import type { SocialChallengeDto } from "../../../types/friends";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function duel(overrides: Partial<SocialChallengeDto> = {}): SocialChallengeDto {
  return {
    id: 7,
    owner_id: 1,
    challenge_kind: "duel",
    title: "You vs bob",
    week_start: "2026-09-28",
    target_sessions: 5,
    status: "active",
    invitee_user_id: 2,
    members: [
      { user_id: 1, username: "alice", progress_sessions: 0, profile_picture_url: "/media/alice.jpg" },
      { user_id: 2, username: "bob", progress_sessions: 0, profile_picture_url: null },
    ],
    ...overrides,
  };
}

const clash = {
  challengeId: 7,
  you: { name: "alice", photoUri: null },
  opponent: { name: "bob", photoUri: null },
};

describe("duel clash payload", () => {
  it("treats only accepted invite duels the user sent as celebratable", () => {
    expect(isAcceptedOwnedDuel(duel(), 1)).toBe(true);
    expect(isAcceptedOwnedDuel(duel(), 2)).toBe(false);
    expect(isAcceptedOwnedDuel(duel({ status: "pending" }), 1)).toBe(false);
    expect(isAcceptedOwnedDuel(duel({ invitee_user_id: null }), 1)).toBe(false);
  });

  it("puts the opponent on top and resolves profile photos", () => {
    const payload = duelClashPayload(duel(), 1, "You");
    expect(payload?.opponent.name).toBe("bob");
    expect(payload?.opponent.photoUri).toBeNull();
    expect(payload?.you.photoUri).toMatch(/\/media\/alice\.jpg$/);
  });
});

describe("duel clash store", () => {
  afterEach(() => act(() => clearDuelClashQueue()));

  function Probe() {
    const current = useCurrentDuelClash();
    return current ? <Text>{current.opponent.name}</Text> : null;
  }

  it("shows one clash at a time and never queues the same duel twice", () => {
    const { queryByText } = render(<Probe />);
    act(() => {
      showDuelClash(clash);
      showDuelClash(clash);
      showDuelClash({ ...clash, challengeId: 8, opponent: { name: "carol", photoUri: null } });
    });
    expect(queryByText("bob")).toBeTruthy();
    act(() => dismissCurrentDuelClash());
    expect(queryByText("carol")).toBeTruthy();
    act(() => dismissCurrentDuelClash());
    expect(queryByText("carol")).toBeNull();
  });
});

describe("duel clash seen ids", () => {
  it("remembers celebrated duels per user", async () => {
    await markDuelClashSeen(1, 7);
    expect((await loadSeenDuelClashIds(1)).has(7)).toBe(true);
    expect((await loadSeenDuelClashIds(2)).has(7)).toBe(false);
  });
});

describe("DuelClashOverlay", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows both sides with initials when there is no photo and closes on tap", () => {
    const onFinished = jest.fn();
    const { getByTestId, getByText } = render(<DuelClashOverlay clash={clash} onFinished={onFinished} />);
    expect(getByText("bob")).toBeTruthy();
    expect(getByText("AL")).toBeTruthy();
    expect(getByText("VS")).toBeTruthy();
    fireEvent.press(getByTestId("duel-clash-overlay"));
    act(() => jest.advanceTimersByTime(250));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself after a few seconds", () => {
    const onFinished = jest.fn();
    render(<DuelClashOverlay clash={clash} onFinished={onFinished} />);
    act(() => jest.advanceTimersByTime(3500));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
