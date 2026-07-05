import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import DashboardScreen from "../../app/(tabs)/dashboard";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Swipeable: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.withRepeat = (value: unknown) => value;
  Reanimated.withSequence = (...values: unknown[]) => values[0];
  Reanimated.withTiming = (value: unknown) => value;
  return Reanimated;
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    effect();
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects && key === "dashboard.weekdayShort")
        return ["M", "T", "W", "T", "F", "S", "S"];
      return key;
    },
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token", user: { id: 1, username: "alice" } }),
}));

const mockUseDashboardData = jest.fn();
jest.mock("../../features/dashboard/hooks/useDashboardData", () => ({
  useDashboardData: (...args: unknown[]) => mockUseDashboardData(...args),
}));

jest.mock("../../features/dashboard/hooks/useDashboardSessionSetupModal", () => ({
  useDashboardSessionSetupModal: () => ({
    setupVisible: false,
    setupModalKey: "k",
    sheetStyle: {},
    closeSetupModal: jest.fn(),
    presentSessionSetupModalFresh: jest.fn(),
  }),
}));

jest.mock("../../features/dashboard/hooks/useDashboardSocialActions", () => ({
  useDashboardSocialActions: () => ({ socialToast: null, runPrimaryAction: jest.fn() }),
}));

jest.mock("../../features/dashboard/hooks/useDashboardSocialNudges", () => ({
  useDashboardSocialNudges: () => ({
    primaryNudge: null,
    secondaryNudge: null,
    advancePrimaryNudge: jest.fn(),
    applyMomentumAction: jest.fn(),
  }),
}));

jest.mock("../../features/dashboard/hooks/useDashboardStreakEvents", () => ({
  useDashboardStreakEvents: () => ({
    milestoneToast: null,
    breakModalOpen: false,
    breakModalStreak: 0,
    dismissBreakModal: jest.fn(),
  }),
}));

jest.mock("../../components/dashboard/DashboardStudioHud", () => ({
  DashboardStudioHud: ({ hasWeeklyGoal }: { hasWeeklyGoal: boolean }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(
      View,
      { testID: "dashboard-studio-hud" },
      React.createElement(View, {
        testID: hasWeeklyGoal ? "dashboard-quest-progress" : "dashboard-quest-setup",
      }),
      React.createElement(View, { testID: "dashboard-start-session" }),
    );
  },
}));
jest.mock("../../components/dashboard/FriendsActivityWidget", () => ({
  FriendsActivityWidget: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "dashboard-friends-widget" });
  },
}));
jest.mock("../../features/weeklyRecap/WeeklyRecapTeaser", () => ({
  WeeklyRecapTeaser: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "weekly-recap-teaser" });
  },
  isWeeklyRecapTeaserVisible: () => true,
}));
jest.mock("../../hooks/useRankProgression", () => ({
  useRankProgression: () => ({ level: 2 }),
}));
jest.mock("../../components/streak/StreakBreakModal", () => ({
  StreakBreakModal: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View);
  },
}));
jest.mock("../../components/ui/ScreenHeader", () => ({
  ScreenHeader: ({
    titleNode,
    actionNode,
  }: {
    titleNode?: React.ReactNode;
    actionNode?: React.ReactNode;
  }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, titleNode, actionNode);
  },
}));
jest.mock("../../components/ui/PrimaryButton", () => ({
  PrimaryButton: ({ label }: { label: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, label);
  },
}));
jest.mock("../../components/TutorialOverlay", () => ({
  TutorialOverlay: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View);
  },
}));
jest.mock("../../features/dashboard/components/ActiveSessionBlock", () => ({
  ActiveSessionBlock: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View);
  },
}));
jest.mock("../../features/dashboard/components/DashboardSessionSetupModal", () => ({
  DashboardSessionSetupModal: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View);
  },
}));
jest.mock("../../features/dashboard/components/SessionSkeleton", () => ({
  SessionSkeleton: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "Loading sessions...");
  },
}));

jest.mock("../../lib/sessionI18n", () => ({
  sessionTypeLabel: (value: string) => value,
}));

jest.mock("../../lib/motivationEngine", () => ({
  generateMotivationMessage: () => "motivation",
  getTimeBasedGreeting: () => "Hi",
  getTimeOfDay: () => "morning",
}));

jest.mock("../../lib/motivationApi", () => ({
  translateMotivationalMessage: () => "server-motivation",
}));

jest.mock("../../lib/todayPlanEngine", () => ({
  buildTodayPlanRecommendation: () => ({
    status: "on_track",
    suggestedSessionType: "beat_making",
  }),
}));

jest.mock("../../lib/forecastEngine", () => ({
  buildWeeklyForecast: () => null,
}));

jest.mock("../../lib/sessionFeedbackEngine", () => ({
  buildSessionFeedback: () => ({
    progressPercent: 40,
    remainingSessionsToGoal: 3,
    previousStatus: null,
    newStatus: "on_track",
    statusMessageKey: "sessionFeedback.status.onTrack",
    emotionalMessageKey: "sessionFeedback.emotion.solidConsistency",
    nextActionKey: "sessionFeedback.nextAction.keepPace",
    nextActionParams: { sessions: 1, minutes: 30 },
    premiumPreview: { forecastReady: true, habitRiskReady: true, bestTimeReady: true },
  }),
}));

jest.mock("../../lib/notificationInbox", () => ({
  getUnreadCount: jest.fn().mockResolvedValue(0),
  syncServerInbox: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/pushToken", () => ({
  registerPushTokenWithBackend: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/goals", () => ({
  setWeeklyGoal: jest.fn().mockResolvedValue({ target_value: 5 }),
}));

const createDashboardState = (overrides: Record<string, unknown> = {}) => ({
  sessions: [],
  setSessions: jest.fn(),
  active: null,
  setActive: jest.fn(),
  loading: false,
  error: null,
  setError: jest.fn(),
  socialError: null,
  setSocialError: jest.fn(),
  refreshing: false,
  setRefreshing: jest.fn(),
  lastUpdated: null,
  streakOverview: null,
  friendActivity: [],
  friendLeaderboard: { entries: [] },
  socialLoading: false,
  buddyRisk: null,
  checkinStatus: null,
  commitmentStatus: null,
  socialChallenges: [],
  identityState: null,
  weeklyGoalTarget: 4,
  hasWeeklyGoal: true,
  weekSessionsCount: 0,
  loadSessions: jest.fn().mockResolvedValue(undefined),
  loadStreakOverview: jest.fn().mockResolvedValue(undefined),
  loadSocial: jest.fn().mockResolvedValue(undefined),
  refreshDashboard: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("Dashboard Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockUseDashboardData.mockReturnValue(createDashboardState());
  });

  it("renders studio hud while dashboard data is loading", () => {
    mockUseDashboardData.mockReturnValue(createDashboardState({ loading: true }));
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId("dashboard-studio-hud")).toBeTruthy();
  });

  it("renders recent session item after data load", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        sessions: [
          {
            id: 101,
            session_type: "mixing",
            stopped_at: "2026-04-20T10:00:00Z",
            started_at: "2026-04-20T09:30:00Z",
            duration_seconds: 1800,
          },
        ],
      }),
    );
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("mixing")).toBeTruthy();
  });

  it("shows standardized error state when data load fails", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        loading: false,
        error: "Network error",
      }),
    );
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("Network error")).toBeTruthy();
  });

  it("shows start session CTA above the fold", () => {
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId("dashboard-start-session")).toBeTruthy();
  });

  it("shows weekly goal inline setup when no target is set", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        weeklyGoalTarget: null,
        hasWeeklyGoal: false,
      }),
    );
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId("dashboard-quest-setup")).toBeTruthy();
  });

  it("shows weekly goal progress when a target exists", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        weeklyGoalTarget: 5,
        hasWeeklyGoal: true,
        weekSessionsCount: 2,
      }),
    );
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId("dashboard-quest-progress")).toBeTruthy();
  });

  it("shows social warning banner without blocking session list", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        socialError: "dashboard.socialLoadFailed",
        sessions: [
          {
            id: 101,
            session_type: "mixing",
            stopped_at: "2026-04-20T10:00:00Z",
            started_at: "2026-04-20T09:30:00Z",
            duration_seconds: 1800,
          },
        ],
      }),
    );
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("dashboard.socialLoadFailed")).toBeTruthy();
    expect(getByText("mixing")).toBeTruthy();
  });

  it("shows username in greeting", () => {
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("alice")).toBeTruthy();
    expect(getByText("dashboard.heyPrefix")).toBeTruthy();
  });

  it("renders weekly recap teaser and friends widget", () => {
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId("weekly-recap-teaser")).toBeTruthy();
    expect(getByTestId("dashboard-friends-widget")).toBeTruthy();
  });

  it("shows section navigation links for sessions", () => {
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("dashboard.allSessionsLink")).toBeTruthy();
    expect(getByText("dashboard.trashLink")).toBeTruthy();
    expect(getByText("dashboard.statsLink")).toBeTruthy();
  });

  it("navigates to session history from all sessions link", () => {
    const { getByText } = render(<DashboardScreen />);
    fireEvent.press(getByText("dashboard.allSessionsLink"));
    expect(mockPush).toHaveBeenCalledWith("/session/history");
  });

  it("shows empty state when there are no completed sessions", () => {
    mockUseDashboardData.mockReturnValue(createDashboardState({ sessions: [], active: null }));
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("dashboard.emptyStreakTitle")).toBeTruthy();
    expect(getByText("dashboard.startSession")).toBeTruthy();
  });

  it("hides empty state when an active session exists", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        sessions: [],
        active: {
          id: 55,
          session_type: "beat_making",
          started_at: "2026-07-05T10:00:00Z",
          stopped_at: null,
          duration_seconds: null,
        },
      }),
    );
    const { queryByText } = render(<DashboardScreen />);
    expect(queryByText("dashboard.emptyStreakTitle")).toBeNull();
  });

  it("limits recent sessions preview to three items", () => {
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        sessions: [1, 2, 3, 4, 5].map((id) => ({
          id,
          session_type: `type-${id}`,
          stopped_at: "2026-04-20T10:00:00Z",
          started_at: "2026-04-20T09:30:00Z",
          duration_seconds: 1800,
        })),
      }),
    );
    const { getByText, queryByText } = render(<DashboardScreen />);
    expect(getByText("type-1")).toBeTruthy();
    expect(getByText("type-3")).toBeTruthy();
    expect(queryByText("type-4")).toBeNull();
  });

  it("retries social load from warning banner", () => {
    const loadSocial = jest.fn().mockResolvedValue(undefined);
    const setSocialError = jest.fn();
    mockUseDashboardData.mockReturnValue(
      createDashboardState({
        socialError: "dashboard.socialLoadFailed",
        loadSocial,
        setSocialError,
      }),
    );
    const { getByText } = render(<DashboardScreen />);
    fireEvent.press(getByText("common.tryAgain"));
    expect(setSocialError).toHaveBeenCalledWith(null);
    expect(loadSocial).toHaveBeenCalled();
  });
});
