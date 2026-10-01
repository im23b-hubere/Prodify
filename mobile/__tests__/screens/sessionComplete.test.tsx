import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionCompleteScreen from "../../app/session/complete";

const mockReplace = jest.fn();
const mockPush = jest.fn();
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

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
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

function mockBackend(session: SessionOverrides = {}) {
  mockApiJson.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/sessions/item/12/skill-progress") return progressResponder();
    if (path === "/sessions/item/12" && options?.method === "PATCH") return patchResponder();
    if (path === "/sessions/item/12") return Promise.resolve(completedSession(session));
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
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });
});

describe("SessionCompleteScreen focus reflection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patchResponder = () => Promise.resolve(completedSession());
    progressResponder = () => Promise.resolve([]);
  });

  it("asks what the user worked on and saves a picked focus right away", async () => {
    mockBackend();
    const { findByTestId, getByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("skill-focus-beat_making.drums"));

    await waitFor(() => expect(getByText("sessionComplete.focusSaved")).toBeTruthy());
    expect(getByText("sessionComplete.focusTitle")).toBeTruthy();
    expect(focusPatchBodies()).toEqual([["beat_making.drums"]]);
  });

  it("pre-selects the planned focus and saves the correction when it is removed", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.groove"] });
    const { findByTestId, getByText } = render(<SessionCompleteScreen />);

    const plannedChip = await findByTestId("skill-focus-beat_making.groove");
    expect(plannedChip.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(getByText("sessionComplete.focusTitlePlanned")).toBeTruthy();

    fireEvent.press(plannedChip);

    await waitFor(() => expect(focusPatchBodies()).toEqual([[]]));
  });

  it("sends rapid changes one after another so the latest selection wins", async () => {
    mockBackend();
    let resolveFirst: () => void = () => undefined;
    patchResponder = () =>
      new Promise((resolve) => {
        resolveFirst = () => resolve(completedSession());
      });
    const { findByTestId, getByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("skill-focus-beat_making.drums"));
    fireEvent.press(await findByTestId("skill-focus-beat_making.bass"));
    expect(focusPatchBodies()).toEqual([["beat_making.drums"]]);

    patchResponder = () => Promise.resolve(completedSession());
    await act(async () => resolveFirst());

    await waitFor(() => expect(getByText("sessionComplete.focusSaved")).toBeTruthy());
    expect(focusPatchBodies()).toEqual([
      ["beat_making.drums"],
      ["beat_making.drums", "beat_making.bass"],
    ]);
  });

  it("keeps the selection after a failed save and retries it", async () => {
    mockBackend();
    patchResponder = () => Promise.reject(new Error("offline"));
    const { findByTestId, findByText, getByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("skill-focus-beat_making.drums"));
    expect(await findByText("sessionComplete.focusSaveFailed")).toBeTruthy();
    expect(getByTestId("skill-focus-beat_making.drums").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );

    patchResponder = () => Promise.resolve(completedSession());
    fireEvent.press(getByTestId("session-complete-focus-retry"));

    expect(await findByText("sessionComplete.focusSaved")).toBeTruthy();
    expect(focusPatchBodies()).toEqual([["beat_making.drums"], ["beat_making.drums"]]);
  });

  it("does not ask for a focus after a session too short to count", async () => {
    mockBackend({ duration_seconds: 120 });
    const { findByTestId, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByTestId("session-complete-screen")).toBeTruthy();
    expect(queryByTestId("session-complete-focus")).toBeNull();
  });

  it("lets a learning session browse practice areas without dropping the saved focus", async () => {
    mockBackend({ session_type: "learning", skill_focus_ids: ["mixing.eq"] });
    const { findByTestId, getByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("practice-branch-recording"));
    fireEvent.press(getByTestId("practice-branch-mixing"));

    expect(getByTestId("skill-focus-mixing.eq").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(focusPatchBodies()).toEqual([]);
  });

  it("selects every focus of the area with one full-pass tap", async () => {
    mockBackend();
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("full-pass-beat_making"));

    await waitFor(() =>
      expect(lastPatchBody()?.skill_focus_ids).toEqual([
        "beat_making.drums",
        "beat_making.groove",
        "beat_making.bass",
        "beat_making.chords_melody",
        "beat_making.sampling",
        "beat_making.sound_selection",
      ]),
    );
  });

  it("saves the starred focus as the main focus", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums", "beat_making.bass"] });
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(
      await findByTestId("skill-focus-star-beat_making.bass", { includeHiddenElements: true }),
    );

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["beat_making.drums", "beat_making.bass"],
        primary_skill_focus_id: "beat_making.bass",
      }),
    );
  });

  it("offers screen readers the main focus as an action on the tile", async () => {
    mockBackend();
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent(await findByTestId("skill-focus-beat_making.groove"), "accessibilityAction", {
      nativeEvent: { actionName: "mainFocus" },
    });

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["beat_making.groove"],
        primary_skill_focus_id: "beat_making.groove",
      }),
    );
  });

  it("shows the minutes a planned focus earned and how far the next level is", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums"] });
    progressResponder = () => Promise.resolve([skillProgress("beat_making.drums")]);
    const { findByText, getByText } = render(<SessionCompleteScreen />);

    expect(await findByText("sessionComplete.progressGained")).toBeTruthy();
    expect(getByText("sessionComplete.progressToNext")).toBeTruthy();
  });

  it("refreshes the progress after a newly picked focus is saved", async () => {
    mockBackend();
    progressResponder = () => Promise.resolve([skillProgress("beat_making.drums")]);
    const { findByTestId, findByText } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("skill-focus-beat_making.drums"));

    expect(await findByText("sessionComplete.progressGained")).toBeTruthy();
  });

  it("celebrates a level up reached in this session", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums"] });
    progressResponder = () =>
      Promise.resolve([skillProgress("beat_making.drums", { previous_level: 1 })]);
    const { findByText } = render(<SessionCompleteScreen />);

    expect(await findByText("sessionComplete.progressLevelUp")).toBeTruthy();
  });

  it("opens the skill tree at the area of this session", async () => {
    mockBackend();
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("session-complete-skill-tree"));

    expect(mockPush).toHaveBeenCalledWith("/skill-tree?branch=beat_making");
  });

  it("lets a production session add the areas it went into", async () => {
    mockBackend({ session_type: "production", skill_focus_ids: ["beat_making.groove"] });
    const { findByTestId, getByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("worked-area-mixing"));
    fireEvent.press(getByTestId("skill-focus-mixing.eq"));

    await waitFor(() =>
      expect(lastPatchBody()).toEqual({
        skill_focus_ids: ["beat_making.groove", "mixing.eq"],
        primary_skill_focus_id: null,
        area_weights: [
          { branch: "beat_making", weight: 2 },
          { branch: "mixing", weight: 2 },
        ],
      }),
    );
  });

  it("saves how much of the session went into an area", async () => {
    mockBackend({ session_type: "production", skill_focus_ids: ["mixing.eq"] });
    const { findByTestId } = render(<SessionCompleteScreen />);

    fireEvent.press(await findByTestId("area-weight-mixing-3"));

    await waitFor(() =>
      expect(lastPatchBody()?.area_weights).toEqual([{ branch: "mixing", weight: 3 }]),
    );
  });

  it("previews how the session time splits across the weighted areas", async () => {
    mockBackend({
      session_type: "production",
      area_weights: [
        { branch: "beat_making", weight: 3 },
        { branch: "mixing", weight: 2 },
      ],
    });
    const { findByTestId } = render(<SessionCompleteScreen />);

    expect((await findByTestId("area-time-preview")).props.children).toBe(
      "sessionComplete.areaTimeShare · sessionComplete.areaTimeShare",
    );
  });

  it("asks a production session for its areas before showing any focus", async () => {
    mockBackend({ session_type: "production" });
    const { findByText, queryByTestId } = render(<SessionCompleteScreen />);

    expect(await findByText("sessionComplete.areasEmpty")).toBeTruthy();
    expect(queryByTestId("skill-focus-beat_making.drums")).toBeNull();
  });

  it("explains when skill progress cannot be loaded", async () => {
    mockBackend({ skill_focus_ids: ["beat_making.drums"] });
    progressResponder = () => Promise.reject(new Error("offline"));
    const { findByText } = render(<SessionCompleteScreen />);

    expect(await findByText("sessionComplete.progressUnavailable")).toBeTruthy();
  });
});
