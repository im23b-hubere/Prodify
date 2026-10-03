import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SkillTreeRoute from "../../app/skill-tree";

const mockApiJson = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useRouter: () => ({
      back: mockBack,
      canGoBack: mockCanGoBack,
      dismissTo: mockDismissTo,
      push: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock("react-native-gesture-handler", () => {
  const chainable: object = new Proxy({}, { get: () => () => chainable });
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: new Proxy({}, { get: () => () => chainable }),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "level" in options ? `${key}:${options.level}` : key,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-1", user: { id: 7 } }),
}));

jest.mock("../../features/navigation/AppAccessGate", () => ({
  AppAccessGate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

const HOUR = 3600;

function node(totalSeconds: number, level = 1) {
  return {
    total_seconds: totalSeconds,
    level,
    level_start_seconds: 0,
    next_level_seconds: HOUR,
    session_count: totalSeconds > 0 ? 2 : 0,
    last_trained_at: totalSeconds > 0 ? new Date().toISOString() : null,
  };
}

const trainedProfile = {
  total_seconds: 6 * HOUR,
  branches: [{ branch: "mixing", ...node(6 * HOUR, 2) }],
  focuses: [{ skill_id: "mixing.eq", branch: "mixing", ...node(1800, 1) }],
};

/** What VoiceOver and TalkBack send when a node is double-tapped. */
async function activateNode(id: string) {
  fireEvent(await screen.findByTestId(`skill-tree-node-${id}`), "accessibilityAction", {
    nativeEvent: { actionName: "activate" },
  });
}

async function renderMeasuredTree() {
  render(<SkillTreeRoute />);
  fireEvent(await screen.findByTestId("skill-tree-viewport"), "layout", {
    nativeEvent: { layout: { width: 390, height: 800 } },
  });
}

describe("SkillTreeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockResolvedValue(trainedProfile);
  });

  it("lights up trained skills and keeps the rest locked", async () => {
    await renderMeasuredTree();

    expect(await screen.findByLabelText("skillTree.nodeAccessibility:1")).toBeTruthy();
    expect(screen.getByTestId("skill-tree-node-mixing.eq").props.accessibilityLabel).toBe(
      "skillTree.nodeAccessibility:1",
    );
    expect(screen.getByTestId("skill-tree-node-mixing.saturation").props.accessibilityLabel).toBe(
      "skillTree.nodeLockedAccessibility",
    );
    expect(screen.getByTestId("skill-tree-node-mastering").props.accessibilityLabel).toBe(
      "skillTree.nodeLockedAccessibility",
    );
  });

  it("shows level and progress of a tapped skill", async () => {
    await renderMeasuredTree();

    await activateNode("mixing");

    expect(await screen.findByTestId("skill-tree-detail")).toBeTruthy();
    expect(screen.getByText("skillTree.levelLong:2")).toBeTruthy();
  });

  it("keeps the selected skill open when it is activated again", async () => {
    await renderMeasuredTree();
    await activateNode("mixing");

    await activateNode("mixing");

    expect(screen.getByTestId("skill-tree-detail")).toBeTruthy();
  });

  it("explains how to unlock a locked skill", async () => {
    await renderMeasuredTree();

    await activateNode("mixing.saturation");

    expect(await screen.findByText("skillTree.lockedFocusHint")).toBeTruthy();
  });

  it("closes the detail card", async () => {
    await renderMeasuredTree();
    await activateNode("mixing");

    fireEvent.press(await screen.findByTestId("skill-tree-detail-close"));

    expect(screen.queryByTestId("skill-tree-detail")).toBeNull();
  });

  it("invites a new producer to their first session", async () => {
    mockApiJson.mockResolvedValue({ total_seconds: 0, branches: [], focuses: [] });

    await renderMeasuredTree();

    expect(await screen.findByTestId("skill-tree-empty")).toBeTruthy();
  });

  it("offers a retry when the tree cannot load", async () => {
    mockApiJson.mockRejectedValueOnce(new Error("offline"));
    render(<SkillTreeRoute />);

    fireEvent.press(await screen.findByText("skillTree.retry"));

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("skill-tree-viewport")).toBeTruthy();
  });

  it("opens a skill from the list view in the tree", async () => {
    await renderMeasuredTree();
    await screen.findByLabelText("skillTree.nodeAccessibility:1");

    fireEvent.press(screen.getByTestId("skill-tree-toggle-view"));
    fireEvent.press(await screen.findByTestId("skill-tree-row-mixing.eq"));

    expect(await screen.findByTestId("skill-tree-detail")).toBeTruthy();
    expect(screen.queryByTestId("skill-tree-list")).toBeNull();
  });

  it("celebrates skills unlocked since the last visit and shows them", async () => {
    await AsyncStorage.clear();
    await renderMeasuredTree();

    fireEvent.press(await screen.findByTestId("skill-tree-new-unlocks"));

    expect(await screen.findByTestId("skill-tree-detail")).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("does not celebrate skills that were already seen", async () => {
    await AsyncStorage.setItem("prodify_skill_tree_seen_v1_7", JSON.stringify(["mixing.eq"]));
    await renderMeasuredTree();
    await screen.findByTestId("skill-tree-overview");

    expect(screen.queryByTestId("skill-tree-new-unlocks")).toBeNull();
  });

  it("zooms out to the whole tree from the overview map", async () => {
    await renderMeasuredTree();
    await activateNode("mixing");

    fireEvent.press(await screen.findByTestId("skill-tree-overview"));

    expect(screen.queryByTestId("skill-tree-detail")).toBeNull();
  });

  it("goes back", async () => {
    render(<SkillTreeRoute />);

    fireEvent.press(await screen.findByTestId("skill-tree-back"));

    expect(mockBack).toHaveBeenCalled();
  });

  it("falls back to the stats tab when there is no screen to go back to", async () => {
    mockCanGoBack.mockReturnValueOnce(false);
    render(<SkillTreeRoute />);

    fireEvent.press(await screen.findByTestId("skill-tree-back"));

    expect(mockDismissTo).toHaveBeenCalledWith("/(tabs)/stats");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
