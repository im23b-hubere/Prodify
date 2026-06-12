import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionCompleteScreen from "../../app/session/complete";

const mockReplace = jest.fn();
const mockApiJson = jest.fn();
const translate = (key: string, options?: Record<string, unknown>) => {
  if (key === "common.weekdaysFull") {
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  }
  if (options && Object.keys(options).length > 0) return key;
  return key;
};

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ id: "12" }),
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
  useAuth: () => ({ token: "token-123", user: { id: 1, created_at: "2026-04-20T10:00:00Z" } }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/billing", () => ({
  fetchEntitlement: jest.fn().mockResolvedValue({ entitlement: "free", trial_active: false }),
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

jest.mock("../../components/ui/AppCard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppCard: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe("SessionCompleteScreen tracking UX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/sessions/item/12" && (!opts || opts.method === undefined)) {
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
      if (path === "/sessions/item/12" && opts?.method === "PATCH") {
        return Promise.reject(new Error("save failed"));
      }
      return Promise.resolve(null);
    });
  });

  it("shows save error for track outcome and enforces 160-char title limit", async () => {
    const { findByText, findByPlaceholderText, getByText, getAllByText } = render(
      <SessionCompleteScreen />,
    );

    await waitFor(() => expect(getByText("sessionComplete.trackOutcomeTitle")).toBeTruthy());

    const finishedOption = getAllByText("sessionComplete.trackOutcomeFinished", {
      includeHiddenElements: true,
    })[0];
    fireEvent.press(finishedOption);
    const titleInput = await findByPlaceholderText("sessionComplete.trackTitlePlaceholder");

    expect(titleInput.props.maxLength).toBe(160);

    fireEvent.changeText(titleInput, "My Track");
    fireEvent.press(getByText("sessionComplete.trackSaveCta"));

    await waitFor(() => expect(getByText("save failed")).toBeTruthy());
  }, 15000);

  it("pauses auto-return timer after track interaction", async () => {
    jest.useFakeTimers();
    try {
      const { findByText, queryByText } = render(<SessionCompleteScreen />);

      await findByText("sessionComplete.autoReturn");
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/dashboard");

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      const finishedOption = await findByText("sessionComplete.trackOutcomeFinished");
      fireEvent.press(finishedOption);

      await findByText("sessionComplete.autoReturnCancelled");

      await act(async () => {
        jest.advanceTimersByTime(20000);
      });

      expect(queryByText("sessionComplete.autoReturnCancelled")).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/dashboard");
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it("keeps user on completion screen after tapping stay here", async () => {
    jest.useFakeTimers();
    try {
      const { findByText, queryByText } = render(<SessionCompleteScreen />);

      const stayHereButton = await findByText("sessionComplete.stayHere");
      fireEvent.press(stayHereButton);

      await findByText("sessionComplete.autoReturnCancelled");

      await act(async () => {
        jest.advanceTimersByTime(20000);
      });

      expect(queryByText("sessionComplete.autoReturnCancelled")).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/dashboard");
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
});
