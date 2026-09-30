import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ChallengeNewRoute from "../../app/challenge/new";

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockApiJson = jest.fn();
const mockFetchChallenges = jest.fn();
const mockCreateChallenge = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: View };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", user: { id: 1, username: "eric" } }),
}));

// Access control is covered by protectedStackRoutes.test.tsx.
jest.mock("../../features/navigation/AppAccessGate", () => ({
  AppAccessGate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, dismissTo: mockDismissTo, push: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/social", () => ({
  fetchChallenges: (...args: unknown[]) => mockFetchChallenges(...args),
  createChallenge: (...args: unknown[]) => mockCreateChallenge(...args),
}));

jest.mock("../../lib/momentum", () => ({
  recordMomentumAction: jest.fn().mockResolvedValue(undefined),
}));

function leaderboardWith(...names: [number, string][]) {
  return {
    period: "week",
    entries: names.map(([userId, username], index) => ({
      rank: index + 1,
      user_id: userId,
      username,
      current_streak_days: 0,
      sessions_in_period: 0,
    })),
  };
}

describe("Challenge create sheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockFetchChallenges.mockResolvedValue([]);
    mockCreateChallenge.mockResolvedValue({ id: 42 });
    mockApiJson.mockResolvedValue(leaderboardWith([2, "bob"], [3, "carol"]));
  });

  it("walks friend, goal and review steps and sends a duel", async () => {
    render(<ChallengeNewRoute />);

    fireEvent.press(await screen.findByTestId("challenge-friend-2"));
    fireEvent.press(screen.getByTestId("challenge-create-continue"));
    expect(await screen.findByTestId("challenge-preset-classic")).toBeTruthy();

    fireEvent.press(screen.getByTestId("challenge-create-continue"));
    expect(await screen.findByText("eric vs bob")).toBeTruthy();

    fireEvent.press(screen.getByTestId("challenge-create-continue"));
    await waitFor(() =>
      expect(mockCreateChallenge).toHaveBeenCalledWith(
        "token-123",
        expect.objectContaining({ title: "eric vs bob", member_user_ids: [2] }),
      ),
    );
    expect(await screen.findByTestId("challenge-sent")).toBeTruthy();
  });

  it("falls back to the generated title when the custom title is cleared", async () => {
    mockSearchParams = { friendId: "2" };
    render(<ChallengeNewRoute />);
    fireEvent.press(await screen.findByTestId("challenge-create-continue"));

    fireEvent.press(await screen.findByLabelText("challengeCreate.editTitle"));
    const input = screen.getByLabelText("challengeCreate.titleLabel");
    fireEvent.changeText(input, "  ");
    fireEvent(input, "blur");

    expect(screen.getByText("eric vs bob")).toBeTruthy();
    expect(screen.queryByText("challengeCreate.useDefaultTitle")).toBeNull();
  });

  it("starts on the goal step when opened from a friend's profile", async () => {
    mockSearchParams = { friendId: "3" };
    render(<ChallengeNewRoute />);

    expect(await screen.findByTestId("challenge-preset-classic")).toBeTruthy();
    expect(screen.queryByTestId("challenge-friend-3")).toBeNull();
  });

  it("offers adding a friend when the friend list is empty", async () => {
    mockApiJson.mockResolvedValue(leaderboardWith([1, "eric"]));
    render(<ChallengeNewRoute />);

    fireEvent.press(await screen.findByText("challengeCreate.addFriend"));
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: "/(tabs)/friends",
      params: { addFriend: "1" },
    });
  });

  it("shows a retryable error when loading fails", async () => {
    mockApiJson.mockRejectedValueOnce(new Error("offline"));
    render(<ChallengeNewRoute />);

    expect(await screen.findByText("challengeCreate.loadErrorTitle")).toBeTruthy();
    fireEvent.press(screen.getByText("common.tryAgain"));
    expect(await screen.findByTestId("challenge-friend-2")).toBeTruthy();
  });
});
