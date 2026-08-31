import { fireEvent, render, screen } from "@testing-library/react-native";
import type { TFunction } from "i18next";
import type { ComponentProps } from "react";

import { DashboardStudioHud } from "../../../components/dashboard/DashboardStudioHud";
import type { SessionDto } from "../../../types/session";

jest.mock("lucide-react-native", () => ({
  Shield: () => null,
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.withRepeat = (value: unknown) => value;
  Reanimated.withSequence = (...values: unknown[]) => values[0];
  Reanimated.withTiming = (value: unknown) => value;
  return Reanimated;
});

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock("../../../components/studio/WeeklyQuestCard", () => ({
  WeeklyQuestCard: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "weekly-quest-card" });
  },
}));

jest.mock("../../../components/dashboard/DashboardWeekDots", () => ({
  DashboardWeekDots: () => null,
}));

const mockOnQuickStart = jest.fn();
const mockT = ((key: string) => key) as TFunction;

const baseProps = {
  t: mockT,
  loading: false,
  activeResolved: true,
  active: null,
  stopBusy: false,
  onQuickStart: mockOnQuickStart,
  onOpenFullscreen: jest.fn(),
  onConfirmStop: jest.fn(),
  hasWeeklyGoal: false,
  weekSessionsCount: 0,
  weeklyGoalTarget: null,
  goalSaving: false,
  onSaveWeeklyGoal: jest.fn(),
  feedback: {
    progressPercent: 0,
    remainingSessionsToGoal: 0,
    previousStatus: null,
    newStatus: "on_track" as const,
    statusMessageKey: "sessionFeedback.status.onTrack",
    emotionalMessageKey: "sessionFeedback.emotion.solidConsistency",
    nextActionKey: "sessionFeedback.nextAction.keepPace",
    nextActionParams: { sessions: 1, minutes: 30 },
    premiumPreview: { forecastReady: false, habitRiskReady: false, bestTimeReady: false },
  },
  paceForecast: null,
  streakOverview: null,
  streakCount: 0,
  todaySessions: 0,
  todayMinutes: 0,
  level: null,
  freezeBusy: false,
  onUseFreeze: jest.fn(),
  onFreezeUnavailable: jest.fn(),
  onOpenStreakHistory: jest.fn(),
} satisfies ComponentProps<typeof DashboardStudioHud>;

describe("DashboardStudioHud session start gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state instead of Start Session while active session is unresolved", () => {
    render(<DashboardStudioHud {...baseProps} activeResolved={false} />);

    expect(screen.getByTestId("dashboard-start-session-loading")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-start-session")).toBeNull();
    expect(mockOnQuickStart).not.toHaveBeenCalled();
  });

  it("renders Start Session when active session is resolved and none is running", () => {
    render(<DashboardStudioHud {...baseProps} activeResolved={true} active={null} />);

    fireEvent.press(screen.getByLabelText("sessionStarter.title"));
    expect(mockOnQuickStart).toHaveBeenCalledTimes(1);
  });

  it("renders the active session block instead of Start Session when one exists", () => {
    render(
      <DashboardStudioHud
        {...baseProps}
        activeResolved={true}
        active={{
          id: 9,
          user_id: 1,
          started_at: "2026-08-31T10:00:00.000Z",
          stopped_at: null,
          duration_seconds: 300,
          session_type: "beat_making",
          notes: null,
        } satisfies SessionDto}
      />,
    );

    expect(screen.queryByTestId("dashboard-start-session")).toBeNull();
    expect(screen.queryByTestId("dashboard-start-session-loading")).toBeNull();
    expect(screen.getByTestId("dashboard-stop-session")).toBeTruthy();
  });
});
