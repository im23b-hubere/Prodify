import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import FriendProfileScreen from "../../app/profile/[id]";

const mockBack = jest.fn();
const mockApiJson = jest.fn();

const translate = (key: string) => key;

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", user: { id: 5, username: "me" } }),
}));

// Access control is covered by protectedStackRoutes.test.tsx.
jest.mock("../../features/navigation/AppAccessGate", () => ({
  AppAccessGate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "9" }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/social", () => ({
  fetchBuddyStatus: jest.fn().mockResolvedValue(null),
  fetchWeeklyRecap: jest.fn().mockResolvedValue(null),
}));

describe("FriendProfileScreen loading UX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation(() => new Promise(() => undefined));
  });

  it("shows loading state with back navigation while profile loads", async () => {
    const { getByText } = render(<FriendProfileScreen />);

    expect(getByText("common.backArrow")).toBeTruthy();
    await waitFor(() => {
      expect(getByText("friendProfile.loadingProfile")).toBeTruthy();
    });
  });
});

describe("FriendProfileScreen commitment", () => {
  const profile = {
    id: 9,
    username: "carol",
    total_sessions: 12,
    current_streak: 3,
    longest_streak: 5,
    friends_count: 2,
    created_at: "2026-01-01T00:00:00Z",
  };
  const stats = {
    total_hours: 10,
    total_sessions: 12,
    current_streak: 3,
    longest_streak: 5,
    type_breakdown: {},
    best_day: null,
    heatmap_days: [],
    achievements: [],
  };

  function respondWith(commitment: () => Promise<unknown>) {
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/friends/status/9") return Promise.resolve({ status: "accepted" });
      if (path === "/users/9/profile") return Promise.resolve(profile);
      if (path === "/users/9/stats") return Promise.resolve(stats);
      if (path.startsWith("/users/9/sessions")) return Promise.resolve([]);
      if (path === "/users/9/commitment") return commitment();
      return Promise.resolve(null);
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it("shows this week's commitment progress", async () => {
    respondWith(() =>
      Promise.resolve({
        week_start: "2026-09-28",
        target_sessions: 4,
        current_sessions: 1,
        status: "behind",
      }),
    );
    const { findByTestId, getByText } = render(<FriendProfileScreen />);

    const card = await findByTestId("friend-profile-commitment");
    expect(card.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1 });
    expect(getByText("friendProfile.commitmentStatus.behind")).toBeTruthy();
  });

  it("still shows the profile when the commitment cannot be loaded", async () => {
    respondWith(() => Promise.reject(new Error("offline")));
    const { findByText, queryByTestId } = render(<FriendProfileScreen />);

    expect(await findByText("friendProfile.recentSessions")).toBeTruthy();
    expect(queryByTestId("friend-profile-commitment")).toBeNull();
  });
});
