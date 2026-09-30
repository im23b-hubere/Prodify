import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import FriendsScreen from "../../app/(tabs)/friends";

const mockPush = jest.fn();
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockOnRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
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

const createFriendsActions = (overrides: Record<string, unknown> = {}) => ({
  hasOtherFriends: false,
  entries: [],
  friendCandidates: [],
  challengeCards: [],
  pendingBuddyInviteId: null,
  acceptRequest: mockAcceptRequest,
  declineRequest: mockDeclineRequest,
  sendRequest: jest.fn(),
  inviteBuddy: jest.fn(),
  withdrawChallengeInvite: jest.fn(),
  acceptBuddyInvite: jest.fn(),
  acceptChallengeInvite: jest.fn(),
  declineChallengeInvite: jest.fn(),
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
  challenges: [],
  duelRecords: [],
  commitment: null,
  reactionUsersOpen: false,
  setReactionUsersOpen: jest.fn(),
  reactionUsers: [],
  toastMessage: null,
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

  it("shows empty state when user has no friends on the activity tab", () => {
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("friendsScreen.feedEmptyTitle")).toBeTruthy();
    expect(getByText("friendsScreen.feedEmptyCta")).toBeTruthy();
  });

  it("shows error state with retry", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({ loading: false, error: "Network down" }),
    );
    const { getByText, queryByText } = render(<FriendsScreen />);
    expect(getByText("Network down")).toBeTruthy();
    expect(getByText("common.tryAgain")).toBeTruthy();
    expect(queryByText("friendsScreen.feedEmptyTitle")).toBeNull();
  });

  it("keeps last known Friends data visible when refresh fails", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        error: "Network down",
        leaderboard: {
          period: "week",
          entries: [
            {
              rank: 1,
              user_id: 2,
              username: "bob",
              current_streak_days: 5,
              sessions_in_period: 3,
            },
          ],
        },
        incoming: [{ id: 42, user_id: 3, username: "carol", created_at: "2026-07-01T10:00:00Z" }],
        activity: [
          {
            session_id: 101,
            user_id: 2,
            username: "bob",
            session_type: "beat_making",
            activity_at: "2026-01-01T10:00:00Z",
            duration_seconds: 1800,
            reactions_count: 0,
            comments_count: 0,
          },
        ],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(
      createFriendsActions({
        hasOtherFriends: true,
        entries: [
          { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
          { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
        ],
      }),
    );
    const { getAllByText, getByText, queryByText } = render(<FriendsScreen />);
    expect(getByText("Network down")).toBeTruthy();
    expect(getByText("carol")).toBeTruthy();
    expect(getAllByText("bob").length).toBeGreaterThan(0);
    expect(queryByText("friendsScreen.feedEmptyTitle")).toBeNull();
  });

  it("shows a slim ranking and activity on the same page", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        activity: [
          {
            session_id: 101,
            user_id: 2,
            username: "bob",
            session_type: "beat_making",
            activity_at: "2026-01-01T10:00:00Z",
            duration_seconds: 1800,
            reactions_count: 1,
            comments_count: 0,
            status: "completed",
          },
        ],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(
      createFriendsActions({
        hasOtherFriends: true,
        entries: [
          { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
          { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
        ],
      }),
    );
    const { getByTestId, getByText, queryByTestId, queryByText } = render(<FriendsScreen />);
    expect(queryByTestId("friends-social-summary")).toBeNull();
    expect(queryByTestId("friends-leaderboard-podium")).toBeNull();
    expect(queryByText("friendsScreen.subtitle")).toBeNull();
    expect(queryByText("friendsScreen.feedOpenSessionCta")).toBeNull();
    expect(getByTestId("friends-ranking")).toBeTruthy();
    expect(getByText("friendsScreen.sectionActivityTitle")).toBeTruthy();
  });

  describe("overview standing", () => {
    const ranking = [
      { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
      { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
    ];

    function renderOverview() {
      mockUseFriendsScreenState.mockReturnValue(createFriendsState({ loading: false }));
      mockUseFriendsScreenActions.mockReturnValue(
        createFriendsActions({ hasOtherFriends: true, entries: ranking }),
      );
      return render(<FriendsScreen />);
    }

    it("shows your weekly position and who you are chasing", () => {
      const { getByTestId, getByText } = renderOverview();
      expect(getByTestId("friends-week-hero")).toBeTruthy();
      expect(getByText("#2")).toBeTruthy();
      expect(getByText("friendsOverview.chaseBehind")).toBeTruthy();
    });

    it("starts a session from the weekly hero", () => {
      const { getByTestId } = renderOverview();
      fireEvent.press(getByTestId("friends-week-hero-start"));
      expect(mockPush).toHaveBeenCalledWith("/session/setup");
    });

    it("opens a friend's profile from their ranking row", () => {
      const { getByTestId } = renderOverview();
      fireEvent.press(getByTestId("friends-rank-2"));
      expect(mockPush).toHaveBeenCalledWith("/profile/2");
    });

    it("collapses a long ranking to the top five plus you", () => {
      const crowd = Array.from({ length: 7 }, (_, index) => ({
        rank: index + 1,
        user_id: index + 10,
        username: `friend${index}`,
        current_streak_days: 0,
        sessions_in_period: 10 - index,
      }));
      const entries = [...crowd, { ...ranking[1], rank: 8, sessions_in_period: 0 }];
      mockUseFriendsScreenState.mockReturnValue(createFriendsState({ loading: false }));
      mockUseFriendsScreenActions.mockReturnValue(
        createFriendsActions({ hasOtherFriends: true, entries }),
      );
      const { getByTestId, queryByTestId } = render(<FriendsScreen />);
      expect(queryByTestId("friends-rank-15")).toBeNull();
      expect(getByTestId("friends-rank-1")).toBeTruthy();
      fireEvent.press(getByTestId("friends-ranking-toggle"));
      expect(getByTestId("friends-rank-15")).toBeTruthy();
    });
  });

  it("renders the buddy duel on the challenges page without the crew HUD", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        sectionTab: "challenges",
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
    const { getByTestId, queryByTestId, queryByText } = render(<FriendsScreen />);
    expect(queryByTestId("friends-together-hud")).toBeNull();
    expect(queryByTestId("friends-ranking")).toBeNull();
    expect(getByTestId("friends-buddy-duel")).toBeTruthy();
    expect(queryByText("friendsScreen.sectionActivityTitle")).toBeNull();
    expect(queryByText("friendsScreen.togetherOr")).toBeNull();
    expect(queryByText("friendsScreen.challengeTapHint")).toBeNull();
    expect(queryByText("friendsScreen.challengeKindDuel")).toBeNull();
  });

  describe("duel board", () => {
    const friends = [
      { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
      { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
    ];
    const activeDuel = {
      id: 9,
      owner_id: 1,
      title: "alice vs bob",
      challenge_kind: "duel",
      week_start: "2026-09-28",
      target_sessions: 5,
      days_remaining: 3,
      status: "active",
      members: [
        { user_id: 1, username: "alice", progress_sessions: 2 },
        { user_id: 2, username: "bob", progress_sessions: 3 },
      ],
    };

    function renderBoard(challengeCards: unknown[], stateOverrides: Record<string, unknown> = {}) {
      const withdrawChallengeInvite = jest.fn();
      mockUseFriendsScreenState.mockReturnValue(
        createFriendsState({ loading: false, sectionTab: "challenges", ...stateOverrides }),
      );
      mockUseFriendsScreenActions.mockReturnValue(
        createFriendsActions({
          hasOtherFriends: true,
          entries: friends,
          challengeCards,
          withdrawChallengeInvite,
        }),
      );
      return { ...render(<FriendsScreen />), withdrawChallengeInvite };
    }

    it("shows the running duel as an arena that starts a session", () => {
      const { getByTestId, getByText } = renderBoard([activeDuel]);
      expect(getByTestId("duel-arena")).toBeTruthy();
      expect(getByText("duelBoard.standingBehind")).toBeTruthy();
      fireEvent.press(getByTestId("duel-arena-start"));
      expect(mockPush).toHaveBeenCalledWith("/session/setup");
    });

    it("opens the duel detail from the arena", () => {
      const { getByLabelText } = renderBoard([activeDuel]);
      fireEvent.press(getByLabelText("duelBoard.arenaA11y"));
      expect(mockPush).toHaveBeenCalledWith("/challenge/9");
    });

    it("lets the sender withdraw an unanswered invite", () => {
      const invite = {
        ...activeDuel,
        id: 11,
        status: "pending",
        invitee_user_id: 2,
        invitee_username: "bob",
        members: [{ user_id: 1, username: "alice", progress_sessions: 0 }],
      };
      const { getByTestId, getByLabelText, withdrawChallengeInvite } = renderBoard([invite]);
      expect(getByTestId("duel-waiting-11")).toBeTruthy();
      fireEvent.press(getByLabelText("duelBoard.withdrawA11y"));
      expect(withdrawChallengeInvite).toHaveBeenCalledWith(invite);
    });

    it("challenges a rival with them preselected", () => {
      const { getByTestId } = renderBoard([activeDuel]);
      fireEvent.press(getByTestId("duel-rival-2"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/challenge/new",
        params: { friendId: "2" },
      });
    });

    it("offers a rematch with the same goal after a finished duel", () => {
      const finished = {
        ...activeDuel,
        id: 14,
        status: "completed",
        duration_days: 14,
        winner_user_id: 2,
      };
      const { getByTestId } = renderBoard([finished]);
      fireEvent.press(getByTestId("duel-rematch-14"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/challenge/new",
        params: { friendId: "2", target: "5", days: "14" },
      });
    });

    it("hides the rematch while an invite to that friend is still open", () => {
      const finished = { ...activeDuel, id: 14, status: "completed", winner_user_id: 2 };
      const openInvite = {
        ...activeDuel,
        id: 15,
        status: "pending",
        invitee_user_id: 2,
        members: [{ user_id: 1, username: "alice", progress_sessions: 0 }],
      };
      const { queryByTestId, getByText } = renderBoard([finished, openInvite]);
      expect(queryByTestId("duel-rematch-14")).toBeNull();
      expect(getByText("duelBoard.outcomeLost")).toBeTruthy();
    });

    it("shows the all-time record against a rival", () => {
      const { getByTestId } = renderBoard([activeDuel], {
        duelRecords: [{ friend_user_id: 2, wins: 3, losses: 1, ties: 0 }],
      });
      expect(getByTestId("duel-rival-record-2")).toBeTruthy();
      expect(getByTestId("duel-arena-record")).toBeTruthy();
    });

    it("invites to a first duel when the board is empty", () => {
      const { getByTestId } = renderBoard([]);
      fireEvent.press(getByTestId("duel-board-empty-cta"));
      expect(mockPush).toHaveBeenCalledWith("/challenge/new");
    });

    it("shows a board-shaped skeleton while loading", () => {
      const { getByTestId } = renderBoard([], { loading: true });
      expect(getByTestId("duel-board-skeleton")).toBeTruthy();
    });
  });

  it("shows an incoming duel invite on the overview tab so the invited friend can accept it", () => {
    const acceptChallengeInvite = jest.fn();
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        sectionTab: "overview",
        challenges: [
          {
            id: 12,
            owner_id: 2,
            title: "You vs bob",
            challenge_kind: "duel",
            week_start: "2026-06-30",
            target_sessions: 5,
            status: "pending",
            invitee_user_id: 1,
            members: [{ user_id: 2, username: "bob", progress_sessions: 0 }],
          },
        ],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(
      createFriendsActions({ hasOtherFriends: true, acceptChallengeInvite }),
    );
    const { getByTestId, getByText } = render(<FriendsScreen />);
    expect(getByTestId("duel-invite-12")).toBeTruthy();
    expect(getByText("bob")).toBeTruthy();
    fireEvent.press(getByText("friendsScreen.accept"));
    expect(acceptChallengeInvite).toHaveBeenCalledWith(12);
  });

  describe("live strip and activity", () => {
    const friends = [
      { rank: 1, user_id: 2, username: "bob", current_streak_days: 5, sessions_in_period: 3 },
      { rank: 2, user_id: 1, username: "alice", current_streak_days: 2, sessions_in_period: 1 },
    ];
    const liveSession = {
      session_id: 201,
      user_id: 2,
      username: "bob",
      session_type: "beat_making",
      activity_at: new Date().toISOString(),
      status: "live",
    };
    const finishedSession = {
      session_id: 101,
      user_id: 3,
      username: "carol",
      session_type: "mixing",
      activity_at: new Date().toISOString(),
      duration_seconds: 2700,
      reactions_count: 2,
      comments_count: 0,
      status: "completed",
    };

    function renderActivity(activity: unknown[], actionOverrides: Record<string, unknown> = {}) {
      mockUseFriendsScreenState.mockReturnValue(createFriendsState({ loading: false, activity }));
      mockUseFriendsScreenActions.mockReturnValue(
        createFriendsActions({ hasOtherFriends: true, entries: friends, ...actionOverrides }),
      );
      return render(<FriendsScreen />);
    }

    it("shows friends who are live and opens their profile", () => {
      const { getByTestId } = renderActivity([liveSession, finishedSession]);
      expect(getByTestId("friends-live")).toBeTruthy();
      fireEvent.press(getByTestId("friends-live-2"));
      expect(mockPush).toHaveBeenCalledWith("/profile/2");
    });

    it("keeps running sessions out of the activity feed", () => {
      const { getByTestId, queryByTestId } = renderActivity([liveSession, finishedSession]);
      expect(queryByTestId("friends-activity-201")).toBeNull();
      expect(getByTestId("friends-activity-101")).toBeTruthy();
    });

    it("hides the live strip when nobody is producing", () => {
      const { queryByTestId } = renderActivity([finishedSession]);
      expect(queryByTestId("friends-live")).toBeNull();
    });

    it("groups today's sessions under a day heading", () => {
      const { getByText } = renderActivity([finishedSession]);
      expect(getByText("friendsOverview.today")).toBeTruthy();
    });

    it("reacts to a session from the compact reaction button", () => {
      const toggleThumbReaction = jest.fn();
      const { getByTestId } = renderActivity([finishedSession], { toggleThumbReaction });
      fireEvent.press(getByTestId("friends-activity-react-101", { includeHiddenElements: true }));
      expect(toggleThumbReaction).toHaveBeenCalledWith(finishedSession);
    });

    it("offers the reaction as a screen reader action on the row", () => {
      const toggleThumbReaction = jest.fn();
      const { getByTestId } = renderActivity([finishedSession], { toggleThumbReaction });
      fireEvent(getByTestId("friends-activity-101"), "accessibilityAction", {
        nativeEvent: { actionName: "react" },
      });
      expect(toggleThumbReaction).toHaveBeenCalledWith(finishedSession);
    });

    it("lets you support a friend whose streak broke", () => {
      const supportStreakBreak = jest.fn();
      const streakBreak = {
        session_id: 0,
        user_id: 3,
        username: "carol",
        session_type: "streak",
        activity_at: new Date().toISOString(),
        status: "streak_broken",
        event_message: "Streak ended after 12 days",
      };
      const { getByText } = renderActivity([streakBreak], { supportStreakBreak });
      expect(getByText("Streak ended after 12 days")).toBeTruthy();
      fireEvent.press(getByText("friendsScreen.supportStreakBreakCta"));
      expect(supportStreakBreak).toHaveBeenCalledWith(streakBreak);
    });

    it("shows ten entries until you ask for more", () => {
      const many = Array.from({ length: 12 }, (_, index) => ({
        ...finishedSession,
        session_id: 300 + index,
      }));
      const { getByTestId, queryByTestId } = renderActivity(many);
      expect(queryByTestId("friends-activity-311")).toBeNull();
      fireEvent.press(getByTestId("friends-activity-toggle"));
      expect(getByTestId("friends-activity-311")).toBeTruthy();
    });
  });

  it("collects friend requests and duel invites in one inbox", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        incoming: [{ id: 42, user_id: 3, username: "carol", created_at: "2026-07-01T10:00:00Z" }],
        challenges: [
          {
            id: 12,
            owner_id: 2,
            title: "You vs bob",
            challenge_kind: "duel",
            week_start: "2026-06-30",
            target_sessions: 5,
            status: "pending",
            invitee_user_id: 1,
            members: [{ user_id: 2, username: "bob", progress_sessions: 0 }],
          },
        ],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(createFriendsActions({ hasOtherFriends: true }));
    const { getByTestId, getByText } = render(<FriendsScreen />);
    expect(getByTestId("friends-inbox")).toBeTruthy();
    expect(getByText("friendsOverview.inboxTitle")).toBeTruthy();
    expect(getByTestId("duel-invite-12")).toBeTruthy();
    expect(getByTestId("friend-request-42")).toBeTruthy();
  });

  it("accepts a friend request from the inbox", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        incoming: [{ id: 42, user_id: 3, username: "carol", created_at: "2026-07-01T10:00:00Z" }],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(createFriendsActions({ hasOtherFriends: true }));
    const { getByText } = render(<FriendsScreen />);
    fireEvent.press(getByText("friendsScreen.accept"));
    expect(mockAcceptRequest).toHaveBeenCalledWith(42);
  });

  it("shows incoming friend requests above ranking and activity", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({
        loading: false,
        incoming: [{ id: 42, user_id: 3, username: "carol", created_at: "2026-07-01T10:00:00Z" }],
      }),
    );
    mockUseFriendsScreenActions.mockReturnValue(createFriendsActions({ hasOtherFriends: true }));
    const { getByText, queryByText } = render(<FriendsScreen />);
    expect(getByText("carol")).toBeTruthy();
    expect(queryByText("friendsScreen.subtitle")).toBeNull();
    expect(queryByText("friendsScreen.incomingSectionSub")).toBeNull();
    expect(getByText("friendsOverview.rankingTitle")).toBeTruthy();
    expect(getByText("friendsScreen.sectionActivityTitle")).toBeTruthy();
    expect(getByText("friendsScreen.tabOverview")).toBeTruthy();
    expect(getByText("friendsScreen.tabChallenges")).toBeTruthy();
  });

  it("shows toast message when set", () => {
    mockUseFriendsScreenState.mockReturnValue(
      createFriendsState({ loading: false, toastMessage: "Request sent" }),
    );
    const { getByText } = render(<FriendsScreen />);
    expect(getByText("Request sent")).toBeTruthy();
  });
});
