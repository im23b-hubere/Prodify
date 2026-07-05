import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionDetailScreen from "../../app/session/[id]";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockApiJson = jest.fn();
const mockFetchSessionComments = jest.fn();
const mockCreateSessionComment = jest.fn();
const mockFetchSessionReactions = jest.fn();
const mockToggleSessionReaction = jest.fn();

let mockToken: string | null = "token-123";
const translate = (key: string, options?: Record<string, unknown>) => {
  if (options && Object.keys(options).length > 0) return key;
  return key;
};

const baseSession = {
  id: 12,
  user_id: 1,
  started_at: "2026-04-21T10:00:00Z",
  stopped_at: "2026-04-21T11:00:00Z",
  duration_seconds: 3600,
  session_type: "beat_making",
  notes: "existing note",
  mood_level: 4,
  tags: ["tag-1"],
  paused_duration_seconds: 0,
  pause_started_at: null,
  focus_score: 88,
  track_outcome: "none",
  track_title: null,
};

const mockInsights = {
  focus_score: 88,
  paused_seconds: 0,
  focus_tier: "strong",
  focus_user_average: 75,
  impact_items: [],
  impact_lines: [],
  productivity_items: [],
  productivity_lines: [],
  timeline: [],
};

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children: React.ReactNode;
      testID?: string;
    }) => <View testID={testID}>{children}</View>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: "12" }),
  useSegments: () => ["session", "12"],
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
  useAuth: () => ({
    token: mockToken,
    user: { id: 1, username: "eric", created_at: "2026-04-20T00:00:00Z" },
  }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/social", () => ({
  fetchSessionComments: (...args: unknown[]) => mockFetchSessionComments(...args),
  createSessionComment: (...args: unknown[]) => mockCreateSessionComment(...args),
  fetchSessionReactions: (...args: unknown[]) => mockFetchSessionReactions(...args),
  toggleSessionReaction: (...args: unknown[]) => mockToggleSessionReaction(...args),
}));

jest.mock("../../components/session/SessionInsightSections", () => ({
  SessionInsightSections: () => null,
}));

describe("SessionDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = "token-123";
    mockApiJson.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/sessions/item/12" && opts?.method === "PATCH") {
        return Promise.resolve({ ...baseSession, notes: "updated note" });
      }
      if (path === "/sessions/item/12") {
        return Promise.resolve(baseSession);
      }
      if (path === "/sessions/item/12/insights") {
        return Promise.resolve(mockInsights);
      }
      return Promise.resolve(null);
    });
    mockFetchSessionComments.mockResolvedValue([]);
    mockFetchSessionReactions.mockResolvedValue([]);
    mockToggleSessionReaction.mockResolvedValue([
      { target_type: "session", target_id: 12, emoji: "🔥", count: 1, reacted_by_me: true },
    ]);
  });

  it("shows not signed in error if token is missing", async () => {
    mockToken = null;
    const { findByText } = render(<SessionDetailScreen />);
    expect(await findByText("sessionDetail.notSignedIn")).toBeTruthy();
  });

  it("renders the premium hero card", async () => {
    const { findByTestId } = render(<SessionDetailScreen />);
    expect(await findByTestId("session-detail-hero")).toBeTruthy();
  });

  it("enforces notes max length and toggles reaction", async () => {
    const { findByPlaceholderText, findByText } = render(<SessionDetailScreen />);
    const noteInput = await findByPlaceholderText("sessionDetail.notesPlaceholder");
    expect(noteInput.props.maxLength).toBe(2000);

    const reactionChip = await findByText("🔥");
    fireEvent.press(reactionChip);

    await waitFor(() => {
      expect(mockToggleSessionReaction).toHaveBeenCalledWith("token-123", 12, "🔥");
    });
  });

  it("shows comments error message when comments fail to load", async () => {
    mockFetchSessionComments.mockRejectedValueOnce(new Error("comments down"));
    const { findByText } = render(<SessionDetailScreen />);
    expect(await findByText("sessionDetail.commentsLoadFailed")).toBeTruthy();
  });

  it("shows reactions error message when reactions fail to load", async () => {
    mockFetchSessionReactions.mockRejectedValueOnce(new Error("reactions down"));
    const { findByText } = render(<SessionDetailScreen />);
    expect(await findByText("sessionDetail.reactionsLoadFailed")).toBeTruthy();
  });

  it("shows insights retry banner when insights fail to load", async () => {
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12") {
        return Promise.resolve(baseSession);
      }
      if (path === "/sessions/item/12/insights") {
        return Promise.reject(new Error("insights down"));
      }
      return Promise.resolve(null);
    });

    const { findByText } = render(<SessionDetailScreen />);
    expect(await findByText("sessionDetail.insightsLoadFailed")).toBeTruthy();
    expect(await findByText("common.tryAgain")).toBeTruthy();
  });

  it("shows return-to-active CTA for active sessions", async () => {
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12") {
        return Promise.resolve({ ...baseSession, stopped_at: null, duration_seconds: 900 });
      }
      return Promise.resolve(null);
    });

    const { findByTestId } = render(<SessionDetailScreen />);
    expect(await findByTestId("session-detail-return-active")).toBeTruthy();
  });

  it("navigates back after saving dirty changes", async () => {
    const { findByPlaceholderText, findByText } = render(<SessionDetailScreen />);
    const noteInput = await findByPlaceholderText("sessionDetail.notesPlaceholder");
    fireEvent.changeText(noteInput, "updated note");

    fireEvent.press(await findByText("sessionDetail.saveChanges"));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        "/sessions/item/12",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(mockBack).toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
