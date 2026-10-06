import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProgressionOverviewContent } from "../../../features/progression/components/ProgressionOverviewContent";
import type { ProgressionOverviewState } from "../../../features/progression/hooks/useProgressionOverview";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("expo-blur", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BlurView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("../../../features/progression/components/RankPath", () => ({
  RankPath: ({
    currentLevel,
    xpTotal,
  }: {
    currentLevel: number | null;
    xpTotal: number;
  }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Text, { testID: "rank-path" }, "rank-path"),
      currentLevel == null
        ? null
        : React.createElement(Text, null, `rank-path-current-${currentLevel}`),
      currentLevel == null ? null : React.createElement(Text, null, `path-xp-${xpTotal}`),
    );
  },
}));

function overview(overrides: Partial<ProgressionOverviewState> = {}): ProgressionOverviewState {
  return {
    progression: null,
    levelCatalog: [],
    loadingProgression: false,
    loadingCatalog: false,
    refreshing: false,
    loadError: null,
    load: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const sampleCatalog = [
  { level: 1, xp_start: 0, xp_end_exclusive: 50, xp_span: 50 },
  { level: 2, xp_start: 50, xp_end_exclusive: 100, xp_span: 50 },
];

function renderContent(state: ProgressionOverviewState, signedIn: boolean) {
  const onBack = jest.fn();
  const onSignIn = jest.fn();
  render(
    <ProgressionOverviewContent
      overview={state}
      signedIn={signedIn}
      onBack={onBack}
      onSignIn={onSignIn}
    />,
  );
  return { onBack, onSignIn };
}

describe("ProgressionOverviewContent", () => {
  it("offers sign-in to anonymous users", () => {
    const actions = renderContent(overview(), false);
    fireEvent.press(screen.getByText("progression.signInCta"));
    expect(actions.onSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows load errors with retry and no fabricated Level 1", () => {
    const state = overview({ loadError: "Progress unavailable" });
    renderContent(state, true);
    fireEvent.press(screen.getByText("common.tryAgain"));
    expect(state.load).toHaveBeenCalledWith({ force: true });
    expect(screen.queryByText(/rank-path/)).toBeNull();
    expect(screen.queryByText(/path-xp-/)).toBeNull();
    expect(screen.queryByText(/rank-path-current/)).toBeNull();
  });

  it("shows the rank path shell while progression loads, without inventing a rank", () => {
    renderContent(
      overview({ loadingProgression: true, loadingCatalog: true, progression: null }),
      true,
    );

    expect(screen.getByTestId("progression-overview-loading")).toBeTruthy();
    expect(screen.getByTestId("rank-path")).toBeTruthy();
    expect(screen.queryByText("progression-skeleton")).toBeNull();
    expect(screen.queryByText(/rank-path-current/)).toBeNull();
    expect(screen.queryByText(/path-xp-/)).toBeNull();
  });

  it("shows unavailable state for null progression without fabricating values", () => {
    renderContent(overview({ progression: null, levelCatalog: sampleCatalog }), true);

    expect(screen.getByText("progression.loadError")).toBeTruthy();
    expect(screen.queryByText(/rank-path-current/)).toBeNull();
    expect(screen.queryByText(/path-xp-/)).toBeNull();
    expect(screen.queryByText(/rank-path/)).toBeNull();
  });

  it("shows unavailable state for malformed/missing progression payload semantics", () => {
    // Hook/parser already nulls malformed payloads; overview must not invent progress.
    renderContent(
      overview({
        progression: null,
        loadingProgression: false,
        loadError: null,
        levelCatalog: sampleCatalog,
      }),
      true,
    );

    expect(screen.queryByText(/rank-path-current/)).toBeNull();
    expect(screen.queryByText(/50 XP/)).toBeNull();
    expect(screen.getByText("common.tryAgain")).toBeTruthy();
  });

  it("renders genuine Level 1 / 0 XP progression", () => {
    renderContent(
      overview({
        progression: {
          current_level: 1,
          xp_total: 0,
          xp_to_next_level: 50,
          progress_percent: 0,
        },
        levelCatalog: sampleCatalog,
      }),
      true,
    );

    expect(screen.getByText("path-xp-0")).toBeTruthy();
    expect(screen.getByText("rank-path-current-1")).toBeTruthy();
  });

  it("renders higher-level progression without inventing Level 1", () => {
    renderContent(
      overview({
        progression: {
          current_level: 3,
          xp_total: 250,
          xp_to_next_level: 75,
          progress_percent: 42,
        },
        levelCatalog: [
          ...sampleCatalog,
          { level: 3, xp_start: 100, xp_end_exclusive: 175, xp_span: 75 },
        ],
      }),
      true,
    );

    expect(screen.getByText("path-xp-250")).toBeTruthy();
    expect(screen.getByText("rank-path-current-3")).toBeTruthy();
    expect(screen.queryByText("rank-path-current-1")).toBeNull();
  });

  it("renders the path even while the rank catalog is still loading", () => {
    renderContent(
      overview({
        progression: {
          current_level: 2,
          xp_total: 80,
          xp_to_next_level: 70,
          progress_percent: 20,
        },
        loadingCatalog: true,
        levelCatalog: [],
      }),
      true,
    );

    expect(screen.getByText("rank-path-current-2")).toBeTruthy();
    expect(screen.queryByText("progression-skeleton")).toBeNull();
  });

  it("keeps levels past the named catalog on the summit node", () => {
    renderContent(
      overview({
        progression: {
          current_level: 23,
          xp_total: 25000,
          xp_to_next_level: 1000,
          progress_percent: 10,
        },
      }),
      true,
    );

    expect(screen.getByText("rank-path-current-20")).toBeTruthy();
  });

  it("goes back from the top bar on the path screen", () => {
    const actions = renderContent(
      overview({
        progression: {
          current_level: 1,
          xp_total: 25,
          xp_to_next_level: 25,
          progress_percent: 50,
        },
        levelCatalog: sampleCatalog,
      }),
      true,
    );

    fireEvent.press(screen.getByLabelText("common.goBack"));
    expect(actions.onBack).toHaveBeenCalledTimes(1);
  });

  it("opens the rank rules from the info button", () => {
    renderContent(
      overview({
        progression: {
          current_level: 1,
          xp_total: 25,
          xp_to_next_level: 25,
          progress_percent: 50,
        },
      }),
      true,
    );

    expect(screen.queryByText("progression.info.earnTitle")).toBeNull();
    fireEvent.press(screen.getByLabelText("progression.info.open"));
    expect(screen.getByText("progression.info.earnTitle")).toBeTruthy();
    fireEvent.press(screen.getByText("progression.info.close"));
    expect(screen.queryByText("progression.info.earnTitle")).toBeNull();
  });
});
