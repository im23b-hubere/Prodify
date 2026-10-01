import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { apiJson } from "../../lib/client";

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.FadeIn = { duration: () => ({}) };
  Reanimated.FadeOut = { duration: () => ({}) };
  return Reanimated;
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", hydrated: true }),
}));

jest.mock("../../lib/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    payload: unknown;
    constructor(status: number, message: string, payload: unknown = null) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  },
  apiJson: jest.fn(),
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

describe("SessionSetupForm tag validation", () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    mockApiJson.mockRejectedValue(new Error("offline"));
  });

  it("shows validation hints for too-long and duplicate tags", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SessionSetupForm initialSessionType="beat_making" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByText("sessionSetup.addOptionalDetails"));

    const tagInput = getByPlaceholderText("sessionSetup.tagPlaceholder");

    fireEvent.changeText(tagInput, "a".repeat(33));
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagTooLong")).toBeTruthy();
    });

    fireEvent.changeText(tagInput, "trap");
    fireEvent.press(getByText("+"));

    fireEvent.changeText(tagInput, "trap");
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagAlreadyAdded")).toBeTruthy();
    });
  });

  it("shows validation hint when tag limit is reached", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SessionSetupForm initialSessionType="beat_making" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByText("sessionSetup.addOptionalDetails"));
    const tagInput = getByPlaceholderText("sessionSetup.tagPlaceholder");

    for (let i = 1; i <= 20; i += 1) {
      fireEvent.changeText(tagInput, `tag${i}`);
      fireEvent.press(getByText("+"));
    }

    fireEvent.changeText(tagInput, "overflow-tag");
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagLimitReached")).toBeTruthy();
    });
  });
});

const STARTED_SESSION = { id: 7, started_at: "2026-09-30T10:00:00Z" };

function respondWith(skillProfile: unknown) {
  mockApiJson.mockImplementation(async (path: string) => {
    if (path !== "/skills/profile") return STARTED_SESSION;
    if (skillProfile instanceof Error) throw skillProfile;
    return skillProfile;
  });
}

function startBody() {
  const call = mockApiJson.mock.calls.find(([path]) => path === "/sessions/start");
  return (call?.[1] as { body: Record<string, unknown> }).body;
}

async function waitForSessionStart() {
  await waitFor(() =>
    expect(mockApiJson.mock.calls.some(([path]) => path === "/sessions/start")).toBe(true),
  );
}

const EMPTY_SKILL_PROFILE = { total_seconds: 0, branches: [], focuses: [] };

describe("SessionSetupForm skill focus", () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    respondWith(new Error("offline"));
  });

  it("starts without skill focuses when none are picked", async () => {
    const { getByText } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByText("sessionSetup.startCta"));

    await waitForSessionStart();
    expect(startBody().skill_focus_ids).toBeUndefined();
  });

  it("sends picked focuses in the order they were chosen", async () => {
    const { getByTestId, getByText } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByTestId("skill-focus-mixing.dynamics"));
    fireEvent.press(getByTestId("skill-focus-mixing.eq"));
    fireEvent.press(getByText("sessionSetup.startCta"));

    await waitForSessionStart();
    expect(startBody().skill_focus_ids).toEqual(["mixing.dynamics", "mixing.eq"]);
  });

  it("disables other focuses once two are picked", () => {
    const { getByTestId } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByTestId("skill-focus-mixing.eq"));
    fireEvent.press(getByTestId("skill-focus-mixing.dynamics"));

    expect(getByTestId("skill-focus-mixing.space").props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(getByTestId("skill-focus-mixing.eq").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, disabled: false }),
    );
  });

  it("drops focuses that do not fit a newly selected session type", async () => {
    const { getByTestId, getByText } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByTestId("skill-focus-mixing.eq"));
    fireEvent.press(getByTestId("session-type-beat_making"));
    fireEvent.press(getByText("sessionSetup.startCta"));

    await waitForSessionStart();
    expect(startBody().session_type).toBe("beat_making");
    expect(startBody().skill_focus_ids).toBeUndefined();
  });

  it("shows both mixing and mastering focuses for mix & master", () => {
    const { getByTestId } = render(
      <SessionSetupForm initialSessionType="mix_and_master" onStarted={jest.fn()} />,
    );

    expect(getByTestId("skill-focus-mixing.eq")).toBeTruthy();
    expect(getByTestId("skill-focus-mastering.loudness")).toBeTruthy();
  });

  it("asks for a practice area first in learning sessions, then shows a practice prompt", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <SessionSetupForm initialSessionType="learning" onStarted={jest.fn()} />,
    );

    expect(queryByTestId("skill-focus-mixing.eq")).toBeNull();

    fireEvent.press(getByTestId("practice-branch-mixing"));
    fireEvent.press(getByTestId("skill-focus-mixing.eq"));

    expect(getByText("skills.mixing.focuses.eq.practice")).toBeTruthy();
  });

  it("only submits focuses from the practice area picked last", async () => {
    const { getByTestId, getByText } = render(
      <SessionSetupForm initialSessionType="learning" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByTestId("practice-branch-mixing"));
    fireEvent.press(getByTestId("skill-focus-mixing.eq"));
    fireEvent.press(getByTestId("practice-branch-recording"));
    fireEvent.press(getByTestId("skill-focus-recording.room"));
    fireEvent.press(getByText("sessionSetup.startCta"));

    await waitForSessionStart();
    expect(startBody().skill_focus_ids).toEqual(["recording.room"]);
  });
});

describe("SessionSetupForm focus suggestions", () => {
  const nearlyLevelledEq = {
    skill_id: "mixing.eq",
    branch: "mixing",
    total_seconds: 3000,
    level: 1,
    level_start_seconds: 0,
    next_level_seconds: 3600,
    session_count: 2,
    last_trained_at: "2026-09-20T10:00:00Z",
  };

  beforeEach(() => {
    mockApiJson.mockReset();
    respondWith({ ...EMPTY_SKILL_PROFILE, total_seconds: 3000, focuses: [nearlyLevelledEq] });
  });

  it("suggests skills for the chosen session type once the skill profile loads", async () => {
    const { findByTestId, getByTestId } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    expect(await findByTestId("focus-suggestion-mixing.eq")).toBeTruthy();
    expect(getByTestId("focus-suggestion-mixing.eq").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: false }),
    );
  });

  it("selects the suggested skill together with its chip", async () => {
    const { findByTestId, getByTestId } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(await findByTestId("focus-suggestion-mixing.eq"));

    expect(getByTestId("skill-focus-mixing.eq").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it("reports which skills were suggested when the session starts", async () => {
    const { findByTestId, getByText } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    fireEvent.press(await findByTestId("focus-suggestion-mixing.eq"));
    fireEvent.press(getByText("sessionSetup.startCta"));

    await waitForSessionStart();
    expect(startBody().skill_focus_ids).toEqual(["mixing.eq"]);
    expect(startBody().suggested_skill_focus_ids).toEqual(["mixing.eq", "mixing.balance"]);
  });

  it("hides suggestions when the skill profile cannot be loaded", async () => {
    respondWith(new Error("offline"));
    const { queryByTestId, getByText } = render(
      <SessionSetupForm initialSessionType="mixing" onStarted={jest.fn()} />,
    );

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith("/skills/profile", expect.anything()),
    );
    expect(queryByTestId("focus-suggestions")).toBeNull();

    fireEvent.press(getByText("sessionSetup.startCta"));
    await waitForSessionStart();
    expect(startBody().suggested_skill_focus_ids).toBeUndefined();
  });
});
