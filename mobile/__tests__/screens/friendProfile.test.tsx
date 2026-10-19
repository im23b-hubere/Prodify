import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import FriendProfileScreen from "../../app/profile/[id]";

const mockBack = jest.fn();
const mockApiJson = jest.fn();

const translate = (key: string) => key;

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
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
}));

type MenuItem = { label: string; onSelect: () => void };
const mockShowActionMenu = jest.fn();

jest.mock("../../features/safety/showActionMenu", () => ({
  showActionMenu: (menu: unknown) => mockShowActionMenu(menu),
}));

function pickMenuItem(label: string) {
  const menu = mockShowActionMenu.mock.calls.at(-1)?.[0] as { items: MenuItem[] };
  menu.items.find((item) => item.label === label)?.onSelect();
}

const profile = {
  id: 9,
  username: "carol",
  total_sessions: 12,
  current_streak: 3,
  longest_streak: 5,
  friends_count: 2,
  created_at: "2026-01-01T00:00:00Z",
};

function statsWith(overrides: Record<string, unknown> = {}) {
  return {
    total_hours: 10,
    total_sessions: 12,
    current_streak: 3,
    longest_streak: 5,
    type_breakdown: {},
    best_day: null,
    heatmap_days: [],
    achievements: [],
    ...overrides,
  };
}

type Responses = {
  status?: Record<string, unknown>;
  commitment?: () => Promise<unknown>;
  yourStats?: () => Promise<unknown>;
};

function respondWith({
  status = { status: "accepted" },
  commitment = () => Promise.resolve(null),
  yourStats = () => Promise.resolve(statsWith({ current_streak: 1, total_sessions: 20 })),
}: Responses = {}) {
  mockApiJson.mockImplementation((path: string) => {
    if (path === "/friends/status/9") return Promise.resolve(status);
    if (path === "/friends/request") return Promise.resolve({});
    if (path === "/users/9/profile") return Promise.resolve(profile);
    if (path === "/users/9/stats") return Promise.resolve(statsWith());
    if (path === "/users/5/stats") return yourStats();
    if (path.startsWith("/users/9/sessions")) return Promise.resolve([]);
    if (path === "/users/9/commitment") return commitment();
    return Promise.resolve(null);
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("FriendProfileScreen loading UX", () => {
  it("shows a labelled skeleton with back navigation while the profile loads", async () => {
    mockApiJson.mockImplementation(() => new Promise(() => undefined));
    const { getByText, getByLabelText } = render(<FriendProfileScreen />);

    expect(getByText("common.backArrow")).toBeTruthy();
    await waitFor(() => {
      expect(getByLabelText("friendProfile.loadingProfile")).toBeTruthy();
    });
  });
});

describe("FriendProfileScreen commitment", () => {
  it("shows this week's commitment progress", async () => {
    respondWith({
      commitment: () =>
        Promise.resolve({
          week_start: "2026-09-28",
          target_sessions: 4,
          current_sessions: 1,
          status: "behind",
        }),
    });
    const { findByTestId, getByText } = render(<FriendProfileScreen />);

    const card = await findByTestId("friend-profile-commitment");
    expect(card.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1 });
    expect(getByText("friendProfile.commitmentStatus.behind")).toBeTruthy();
  });

  it("still shows the profile when the commitment cannot be loaded", async () => {
    respondWith({ commitment: () => Promise.reject(new Error("offline")) });
    const { findByText, queryByTestId } = render(<FriendProfileScreen />);

    expect(await findByText("friendProfile.recentSessions")).toBeTruthy();
    expect(queryByTestId("friend-profile-commitment")).toBeNull();
  });
});

describe("FriendProfileScreen head to head", () => {
  it("compares the friend against your own stats", async () => {
    respondWith();
    const { findByTestId, getByText } = render(<FriendProfileScreen />);

    expect(await findByTestId("friend-profile-head-to-head")).toBeTruthy();
    expect(getByText("friendProfile.verdict.tied")).toBeTruthy();
  });

  it("falls back to the totals grid when your own stats are unavailable", async () => {
    respondWith({ yourStats: () => Promise.reject(new Error("offline")) });
    const { findByTestId, queryByTestId, getByText } = render(<FriendProfileScreen />);

    expect(await findByTestId("friend-profile-stats")).toBeTruthy();
    expect(queryByTestId("friend-profile-head-to-head")).toBeNull();
    expect(getByText("friendProfile.sessionsLabel")).toBeTruthy();
  });
});

describe("FriendProfileScreen safety menu", () => {
  it("reports the person through the menu", async () => {
    respondWith();
    const { findByLabelText, findByText, getByTestId } = render(<FriendProfileScreen />);

    fireEvent.press(await findByLabelText("safety.menu.profileA11y"));
    act(() => pickMenuItem("safety.menu.report"));
    fireEvent.press(getByTestId("report-reason-spam"));
    fireEvent.press(getByTestId("report-submit"));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith("/reports", {
        token: "token-123",
        method: "POST",
        body: { target_type: "user", user_id: 9, reason: "spam", note: null },
      });
    });
    expect(await findByText("safety.report.doneTitle")).toBeTruthy();
  });

  it("blocks after confirmation and leaves the profile", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    respondWith();
    const { findByLabelText } = render(<FriendProfileScreen />);

    fireEvent.press(await findByLabelText("safety.menu.profileA11y"));
    act(() => pickMenuItem("safety.menu.block"));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockApiJson).toHaveBeenCalledWith("/users/9/block", { token: "token-123", method: "POST" });
  });

  it("offers the menu on profiles you are not friends with", async () => {
    respondWith({ status: { status: "none", username: "carol" } });
    const { findByLabelText } = render(<FriendProfileScreen />);

    expect(await findByLabelText("safety.menu.profileA11y")).toBeTruthy();
  });
});

describe("FriendProfileScreen locked profile", () => {
  it("sends a friend request straight from the profile", async () => {
    respondWith({ status: { status: "none", username: "carol" } });
    const { findByTestId } = render(<FriendProfileScreen />);

    fireEvent.press(await findByTestId("friend-profile-add-friend"));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith("/friends/request", {
        token: "token-123",
        method: "POST",
        body: { username: "carol" },
      });
    });
  });

  it("withdraws an outgoing friend request from the locked profile", async () => {
    respondWith({
      status: {
        status: "pending",
        username: "carol",
        pending_direction: "outgoing",
        friendship_id: 77,
      },
    });
    const { findByTestId } = render(<FriendProfileScreen />);

    fireEvent.press(await findByTestId("friend-profile-withdraw-request"));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith("/friends/77", {
        token: "token-123",
        method: "DELETE",
      });
    });
  });
});

describe("FriendProfileScreen unfriend", () => {
  it("removes an accepted friend from the profile menu", async () => {
    respondWith({ status: { status: "accepted", username: "carol", friendship_id: 88 } });
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    const { findByLabelText } = render(<FriendProfileScreen />);

    fireEvent.press(await findByLabelText("safety.menu.profileA11y"));
    act(() => pickMenuItem("safety.menu.unfriend"));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith("/friends/88", {
        token: "token-123",
        method: "DELETE",
      });
    });
  });
});
