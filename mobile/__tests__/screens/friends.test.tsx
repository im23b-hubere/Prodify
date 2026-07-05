import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import FriendsScreen from "../../app/(tabs)/friends";

const mockPush = jest.fn();
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockOnRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  return Reanimated;
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token", user: { id: 1, username: "alice" } }),
}));

jest.mock("../../lib/notificationInbox", () => ({
  prependNotification: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../lib/socialNotifications", () => ({
  sendLocalSocialNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(() => jest.fn()),
}));

const mockAcceptRequest = jest.fn();
const mockDeclineRequest = jest.fn();
const mockCompleteTriggerAction = jest.fn();

const createFriendsActions = (overrides: Record<string, unknown> = {}) => ({
  hasOtherFriends: false,
  entries: [],
  friendCandidates: [],
  challengeCards: [],
  pendingBuddyInviteId: null,
  activeTriggerCard: null,
  acceptRequest: mockAcceptRequest,
  declineRequest: mockDeclineRequest,
  completeTriggerAction: mockCompleteTriggerAction,
  sendRequest: jest.fn(),
  submitCreateChallenge: jest.fn(),
  resetChallengeModal: jest.fn(),
  inviteBuddy: jest.fn(),
  joinSocialChallengeById: jest.fn(),
  acceptBuddyInvite: jest.fn(),
  toggleThumbReaction: jest.fn(),
  openReactionUsers: jest.fn(),
  supportStreakBreak: jest.fn(),
  ...overrides,
});

const createFriendsState = (overrides: Record<string, unknown> = {}) => ({
  mode: "week" as const,
  setMode: jest.fn(),
  refreshing: false,
  loading: false,
  activity: [],
  incoming: [],
  error: null,
  addOpen: false,
  setAddOpen: jest.fn(),
  addName: "",
  setAddName: jest.fn(),
  addBusy: false,
  actionBusy: null,
  buddy: null,
  commitment: null,
  reactionUsersOpen: false,
  setReactionUsersOpen: jest.fn(),
  reactionUsers: [],
  toastMessage: null,
  challengeCreateOpen: false,
  setChallengeCreateOpen: jest.fn(),
  challengeTitle: "",
  setChallengeTitle: jest.fn(),
  setChallengeKind: jest.fn(),
  challengeTarget: "5",
  setChallengeTarget: jest.fn(),
  challengeDuration: "7",
  setChallengeDuration: jest.fn(),
  selectedMembers: [],
  setSelectedMembers: jest.fn(),
  challengeCreateBusy: false,
  busyActionKey: null,
  reactionUsersLoading: false,
  buddyPickerOpen: false,
  setBuddyPickerOpen: jest.fn(),
  sectionTab: "overview" as const,
  setSectionTab: jest.fn(),
  feedMetricsBySession: {},
  reactionBusyBySession: {},
  ...overrides,
});

const mockUseFriendsScreenState = jest.fn();
const mockUseFriendsScreenActions = jest.fn();

jest.mock("../../features/friends/hooks/useFriendsScreenState", () => ({
  useFriendsScreenState: () => mockUseFriendsScreenState(),
}));

jest.mock("../../features/friends/hooks/useFriendsDashboardData", () => ({
  useFriendsDashboardData: () => ({
    load: mockLoad,
    onRefresh: mockOnRefresh,
  }),
}));

jest.mock("../../features/friends/hooks/useFriendsScreenActions", () => ({
  useFriendsScreenActions: (...args: unknown[]) => mockUseFriendsScreenActions(...args),
}));

describe("Friends Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFriendsScreenState.mockReturnValue(createFriendsState());
    mockUseFriendsScreenActions.mockReturnValue(createFriendsActions());
  });

  it("shows loading state while data is fetching", () => {
    mockUseFriendsScreenState.mockReturnValue(createFriendsState({ loading: true }));
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("friendsScreen.loading")).toBeTruthy();
  });

  it("shows empty state when user has no friends on overview tab", () => {
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("friendsScreen.feedEmptyTitle")).toBeTruthy();
    expect(getByText("friendsScreen.feedEmptyCta")).toBeTruthy();
  });

  it("shows error state with retry", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({ loading: false, error: "Network down" }),
    );
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("Network down")).toBeTruthy();
    expect(getByText("common.tryAgain")).toBeTruthy();
  });

  it("renders social summary and podium when friends exist", () => {
    mockUseFriendsScreenState.mockReturnValue(createFriendsState({ loading: false }));
    mockUseFriendsScreenActions.mockReturnValue(
      createFriendsActions({
        hasOtherFriends: true,
        entries: [
          { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
          { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
        ],
      }),
    );
    const { getByTestId } = render(<FriendsScreen />);
    expect(getByTestId("friends-social-summary")).toBeTruthy();
    expect(getByTestId("friends-leaderboard-podium")).toBeTruthy();
  });

  it("renders crew HUD and buddy duel on tools tab", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        sectionTab: "tools",
        buddy: {
          status: "active",
          buddy_username: "bob",
          buddy_user_id: 2,
          this_week_sessions: 2,
          buddy_week_sessions: 3,
        },
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(
      createFriendsActions({
        hasOtherFriends: true,
        entries: [
          { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
          { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
        ],
        challengeCards: [
          {
            id: 9,
            title: "Duel",
            challenge_kind: "duel",
            week_start: "2026-06-30",
            duration_days: 7,
            status: "active",
            members: [
              { user_id: 1, username: "alice", progress_sessions: 2 },
              { user_id: 2, username: "bob", progress_sessions: 3 },
            ],
          },
        ],
      }),
    );
    const { getByTestId } = render(<FriendsScreen />);
    expect(getByTestId("friends-together-hud")).toBeTruthy();
    expect(getByTestId("friends-buddy-duel")).toBeTruthy();
  });

  it("shows incoming friend requests", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        incoming: [{ id: 42, user_id: 3, username: "carol", created_at: "2026-07-01T10:00:00Z" }],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(createFriendsActions({ hasOtherFriends: true }));
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("carol")).toBeTruthy();
  });

  it("shows toast message when set", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({ loading: false, toastMessage: "Request sent" }),
    );
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("Request sent")).toBeTruthy();
  });
});
