import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionCompleteScreen from "../../app/session/complete";

jest.mock("react-native-gesture-handler", () => require("../../test/gestureHandlerStub"));

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockApiJson = jest.fn();
const translate = (key: string, options?: Record<string, unknown>) => {
  if (options && Object.keys(options).length > 0) return key;
  return key;
};

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "Success" },
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
    dismissTo: jest.fn(),
  }),
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
    PrimaryButton: ({
      label,
      onPress,
      testID,
    }: {
      label: string;
      onPress: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
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

type SessionOverrides = Record<string, unknown>;

function completedSession(overrides: SessionOverrides = {}) {
  return {
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
    skill_focus_ids: [],
    ...overrides,
  };
}

let patchResponder: () => Promise<unknown>;
let progressResponder: () => Promise<unknown>;

function skillProgress(skillId: string, overrides: Record<string, unknown> = {}) {
  return {
    skill_id: skillId,
    gained_seconds: 45 * 60,
    total_seconds: 2 * 3600,
    level: 2,
    previous_level: 2,
    level_start_seconds: 3600,
    next_level_seconds: 3 * 3600,
    ...overrides,
  };
}

function mockBackend(session: SessionOverrides = {}, { totalSessions = 2 } = {}) {
  mockApiJson.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/sessions/item/12/skill-progress") return progressResponder();
    if (path === "/sessions/item/12" && options?.method === "PATCH") return patchResponder();
    if (path === "/sessions/item/12") return Promise.resolve(completedSession(session));
    if (path === "/sessions/stats?period=all") {
      return Promise.resolve({
        period: "all",
        summary: {
          total_seconds: 3600,
          total_sessions: totalSessions,
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
}

function focusPatchBodies(): unknown[] {
  return mockApiJson.mock.calls
    .filter(([, options]) => options?.method === "PATCH")
    .map(([, options]) => options.body.skill_focus_ids);
}

function lastPatchBody() {
  return mockApiJson.mock.calls.filter(([, options]) => options?.method === "PATCH").at(-1)?.[1]
    .body;
}

describe("SessionCompleteScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patchResponder = () => Promise.resolve(completedSession());
    mockBackend();
  });

  it("renders the simplified completion screen with weekly progress and action buttons", async () => {
    const { findByTestId, getByText } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-screen")).toBeTruthy();
    expect(getByText("sessionComplete.heroEyebrow")).toBeTruthy();
    expect(getByText("dashboard.weeklyGoalTitle")).toBeTruthy();
    expect(getByText("sessionComplete.viewDetails")).toBeTruthy();
    expect(getByText("sessionComplete.backToDashboard")).toBeTruthy();
  });

  it("navigates from the primary and secondary actions", async () => {
    const { findByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByText("sessionComplete.viewDetails"));
    expect(mockReplace).toHaveBeenCalledWith("/session/12");

    fireEvent.press(await findByText("sessionComplete.backToDashboard"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("explains why the session did not count for a challenge and opens it on tap", async () => {
    const respondWithoutCredits = mockApiJson.getMockImplementation();
    mockApiJson.mockImplementation((path: string, options?: { method?: string }) =>
      path === "/social/challenges/sessions/12/credits"
        ? Promise.resolve([
            {
              challenge_id: 4,
              challenge_kind: "duel",
              title: "Beat week",
              status: "active",
              credited: false,
              reason: "before_start",
              progress_sessions: 0,
              target_sessions: 5,
              winner_user_id: null,
              is_tie: false,
            },
          ])
        : respondWithoutCredits?.(path, options),
    );
    const { findByText, getByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByText("Beat week"));

    expect(getByText("sessionComplete.challengeSkipBeforeStart")).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith("/challenge/4");
  });

  it("leaves the challenge card out when the session touched no challenge", async () => {
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-screen")).toBeTruthy();
    expect(queryByTestId("session-complete-challenges")).toBeNull();
  });
});

describe("SessionCompleteScreen focus reflection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patchResponder = () => Promise.resolve(completedSession());
    progressResponder = () => Promise.resolve([]);
  });

  it("shows a short list and credits a focus once Add is saved", async () => {
    mockBackend();
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-focus")).toBeTruthy();
    expect(queryByTestId("skill-focus-beat_making.drums")).toBeNull();
    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("add-focus-save"));

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["beat_making.drums"],
        focus_times: [{ skill_id: "beat_making.drums", assigned_seconds: 3600 }],
      }),
    );
    expect(await findByTestId("worked-on-beat_making.drums")).toBeTruthy();
  });

  it("pre-selects the planned focus and saves when it is removed", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.groove"] });
    const { findByTestId, getByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-beat_making.groove")).toBeTruthy();
    expect(queryByTestId("session-complete-skill-tree")).toBeNull();
    expect(getByTestId("worked-on-remove-beat_making.groove").props.accessibilityLabel).toBe(
      "sessionComplete.removeFocus",
    );

    fireEvent.press(await findByTestId("worked-on-remove-beat_making.groove"));

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: [],
        primary_skill_focus_id: null,
      }),
    );
  });

  it("sends rapid adds one after another so the latest list wins", async () => {
    mockBackend();
    let resolveFirst: () => void = () => undefined;
    patchResponder = () =>
      new Promise((resolve) => {
        resolveFirst = () => resolve(completedSession());
      });
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("add-focus-save"));
    fireEvent.press(await findByTestId("add-focus-beat_making.bass"));
    fireEvent.press(await findByTestId("add-focus-save"));
    expect(focusPatchBodies()).toEqual([["beat_making.drums"]]);

    patchResponder = () => Promise.resolve(completedSession());
    await act(async () => resolveFirst());

    await waitFor(() =>
      expect(focusPatchBodies()).toEqual([
        ["beat_making.drums"],
        ["beat_making.drums", "beat_making.bass"],
      ]),
    );
  });

  it("keeps the row after a failed save and retries it", async () => {
    mockBackend();
    patchResponder = () => Promise.reject(new Error("offline"));
    const { findByTestId, findByText, getByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("add-focus-save"));
    expect(await findByText("sessionComplete.focusSaveFailed")).toBeTruthy();
    expect(getByTestId("worked-on-beat_making.drums")).toBeTruthy();

    patchResponder = () => Promise.resolve(completedSession());
    fireEvent.press(getByTestId("session-complete-focus-retry"));

    await waitFor(() =>
      expect(focusPatchBodies()).toEqual([["beat_making.drums"], ["beat_making.drums"]]),
    );
  });

  it("does not ask for a focus after a session too short to count", async () => {
    mockBackend({ duration_seconds: 120 });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-screen")).toBeTruthy();
    expect(queryByTestId("session-complete-focus")).toBeNull();
  });

  it("keeps a learning focus on the list while Add still offers other areas", async () => {
    mockBackend({ session_type: "learning", skill_focus_ids: ["mixing.eq"] });
    const { findByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-mixing.eq")).toBeTruthy();
    fireEvent.press(await findByTestId("worked-on-add"));
    expect(await findByTestId("add-focus-recording.room")).toBeTruthy();
    expect(focusPatchBodies()).toEqual([]);
  });

  it("highlights an empty Worked on list after the first counted session", async () => {
    mockBackend({}, { totalSessions: 1 });
    const { findByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-nudge")).toBeTruthy();
  });

  it("does not highlight Worked on after later sessions", async () => {
    mockBackend();
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-focus")).toBeTruthy();
    expect(queryByTestId("worked-on-nudge")).toBeNull();
  });

  it("does not highlight Worked on when a planned focus is already on the list", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.groove"] }, { totalSessions: 1 });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-beat_making.groove")).toBeTruthy();
    expect(queryByTestId("worked-on-nudge")).toBeNull();
  });

  it("drops the first-session highlight once a focus is credited", async () => {
    mockBackend({}, { totalSessions: 1 });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-nudge")).toBeTruthy();
    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("add-focus-save"));

    await waitFor(() => expect(queryByTestId("worked-on-nudge")).toBeNull());
  });

  it("rebalances the other row live and saves the wheel on Save", async () => {
    mockBackend({
      session_type: "mixing",
      duration_seconds: 92 * 60,
      skill_focus_ids: ["mixing.stereo", "mixing.eq"],
    });
    const { findByTestId, getByText, queryByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-mixing.eq"));
    expect(await findByTestId("duration-wheel")).toBeTruthy();
    fireEvent.press(await findByTestId("duration-wheel-hour-1"));
    fireEvent.press(await findByTestId("duration-wheel-minute-0"));

    expect(getByText("1h")).toBeTruthy();
    expect(getByText("32m")).toBeTruthy();
    expect(queryByTestId("duration-wheel-hour-1")).toBeTruthy();

    fireEvent.press(await findByTestId("duration-wheel-save"));

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["mixing.stereo", "mixing.eq"],
        focus_times: [
          { skill_id: "mixing.stereo", assigned_seconds: 32 * 60 },
          { skill_id: "mixing.eq", assigned_seconds: 60 * 60 },
        ],
      }),
    );
  });

  it("drops the live preview when the wheel is cancelled", async () => {
    mockBackend({
      session_type: "mixing",
      duration_seconds: 92 * 60,
      skill_focus_ids: ["mixing.stereo", "mixing.eq"],
    });
    const { findByTestId, queryByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-mixing.eq"));
    fireEvent.press(await findByTestId("duration-wheel-hour-1"));
    fireEvent.press(await findByTestId("duration-wheel-minute-0"));
    fireEvent.press(await findByTestId("duration-wheel-cancel"));

    expect(queryByText("1h")).toBeNull();
    expect(focusPatchBodies()).toEqual([]);
  });

  it("does not open the wheel when only one focus is credited", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.groove"] });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-beat_making.groove"));
    expect(queryByTestId("duration-wheel")).toBeNull();
  });

  it("uses a minutes-only wheel when the session is under an hour", async () => {
    mockBackend({
      session_type: "mixing",
      duration_seconds: 46 * 60,
      skill_focus_ids: ["mixing.stereo", "mixing.eq"],
    });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-mixing.eq"));
    expect(await findByTestId("duration-wheel-minute-30")).toBeTruthy();
    expect(queryByTestId("duration-wheel-hour-0")).toBeNull();
  });

  it("shows a level pip when this session pushed a focus over a level", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums"] });
    progressResponder = () =>
      Promise.resolve([skillProgress("beat_making.drums", { previous_level: 1, level: 2 })]);
    const { findByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-level-beat_making.drums")).toBeTruthy();
  });

  it("hides the level pip when the focus did not level up", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums"] });
    progressResponder = () => Promise.resolve([skillProgress("beat_making.drums")]);
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("worked-on-beat_making.drums")).toBeTruthy();
    expect(queryByTestId("worked-on-level-beat_making.drums")).toBeNull();
  });

  it("shows the pip after a save that levels the focus", async () => {
    mockBackend();
    progressResponder = () =>
      Promise.resolve([skillProgress("beat_making.drums", { previous_level: 1, level: 2 })]);
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("add-focus-save"));

    expect(await findByTestId("worked-on-level-beat_making.drums")).toBeTruthy();
  });

  it("lets a production session add a focus from another area without weights", async () => {
    mockBackend({ session_type: "production", skill_focus_ids: ["beat_making.groove"] });
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-on-add"));
    fireEvent.press(await findByTestId("add-focus-mixing.eq"));
    fireEvent.press(await findByTestId("add-focus-save"));

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["beat_making.groove", "mixing.eq"],
        focus_times: [
          { skill_id: "beat_making.groove", assigned_seconds: 1800 },
          { skill_id: "mixing.eq", assigned_seconds: 1800 },
        ],
      }),
    );
  });
});
