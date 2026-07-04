import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionCompleteScreen from "../../app/session/complete";

const mockReplace = jest.fn();
const mockApiJson = jest.fn();
const translate = (key: string, options?: Record<string, unknown>) => {
  if (options && Object.keys(options).length > 0) return key;
  return key;
};

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ id: "12" }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", user: { id: 1, created_at: "2026-04-20T10:00:00Z" } }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/progressionSync", () => ({
  syncProgression: jest.fn().mockResolvedValue({
    xp_total: 120,
    current_level: 2,
    xp_to_next_level: 30,
    progress_percent: 60,
  }),
}));

jest.mock("../../components/ui/PrimaryButton", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock("../../components/ui/SecondaryButton", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    SecondaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock("../../components/ui/TextButton", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

describe("SessionCompleteScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12") {
        return Promise.resolve({
          id: 12,
          user_id: 1,
          started_at: "2026-04-21T10:00:00Z",
          stopped_at: "2026-04-21T11:00:00Z",
          duration_seconds: 3600,
          session_type: "beat_making",
          notes: null,
          mood_level: 4,
          tags: ["trap"],
          paused_duration_seconds: 0,
          pause_started_at: null,
          focus_score: 90,
          track_outcome: "none",
          track_title: null,
        });
      }
      if (path === "/sessions/stats?period=all") {
        return Promise.resolve({
          period: "all",
          summary: {
            total_seconds: 3600,
            total_sessions: 1,
            best_streak_days: 1,
            avg_session_seconds: 3600,
            current_streak_days: 2,
            hours_delta_vs_prior_period: null,
          },
          trend: [],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      if (path === "/goals/current") {
        return Promise.resolve({ target_value: 4, current_sessions: 2 });
      }
      return Promise.resolve(null);
    });
  });

  it("renders the simplified completion screen with quest progress and action buttons", async () => {
    const { findByTestId, getByText } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-screen")).toBeTruthy();
    expect(getByText("sessionComplete.heroEyebrow")).toBeTruthy();
    expect(getByText("sessionComplete.weekQuestTitle")).toBeTruthy();
    expect(getByText("sessionComplete.viewDetails")).toBeTruthy();
    expect(getByText("sessionComplete.backToDashboard")).toBeTruthy();
  });

  it("navigates from the primary and secondary actions", async () => {
    const { findByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByText("sessionComplete.viewDetails"));
    expect(mockReplace).toHaveBeenCalledWith("/session/12");

    fireEvent.press(await findByText("sessionComplete.backToDashboard"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });
});
