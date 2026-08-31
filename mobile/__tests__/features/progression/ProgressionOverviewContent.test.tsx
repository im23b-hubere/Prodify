import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProgressionOverviewContent } from "../../../features/progression/components/ProgressionOverviewContent";
import type { ProgressionOverviewState } from "../../../features/progression/hooks/useProgressionOverview";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "progression.xpTotal") return `${params?.xp} XP total`;
      if (key === "progression.toNext") {
        return `${params?.xp} XP to next (${params?.percent}%)`;
      }
      return key;
    },
  }),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
}));

jest.mock("../../../components/progression/ProgressionOverviewSkeleton", () => ({
  ProgressionOverviewSkeleton: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "progression-skeleton");
  },
}));

jest.mock("../../../components/progression/LevelRankHero", () => ({
  LevelRankHeroEmblem: ({ level }: { level: number }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, `level-${level}`);
  },
}));

jest.mock("../../../components/progression/LevelRankRow", () => ({
  LevelRankRow: ({
    entry,
    currentLevel,
  }: {
    entry: { level: number };
    currentLevel: number;
  }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, `rank-${entry.level}-current-${currentLevel}`);
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
      backLabel="Back"
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
    expect(screen.queryByText(/level-1/)).toBeNull();
    expect(screen.queryByText(/0 XP total/)).toBeNull();
    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
  });

  it("shows loading skeleton without fabricated progression values", () => {
    renderContent(
      overview({ loadingProgression: true, loadingCatalog: true, progression: null }),
      true,
    );

    expect(screen.getByTestId("progression-overview-loading")).toBeTruthy();
    expect(screen.getAllByText("progression-skeleton").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
    expect(screen.queryByText(/0 XP total/)).toBeNull();
    expect(screen.queryByText(/level-1/)).toBeNull();
  });

  it("shows unavailable state for null progression without fabricating values", () => {
    renderContent(overview({ progression: null, levelCatalog: sampleCatalog }), true);

    expect(screen.getByText("progression.loadError")).toBeTruthy();
    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
    expect(screen.queryByText(/0 XP total/)).toBeNull();
    expect(screen.queryByText(/level-1/)).toBeNull();
    expect(screen.queryByText(/rank-1-current-1/)).toBeNull();
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

    expect(screen.queryByTestId("progression-hero-ready")).toBeNull();
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

    expect(screen.getByTestId("progression-hero-ready")).toBeTruthy();
    expect(screen.getByText("level-1")).toBeTruthy();
    expect(screen.getByText("0 XP total")).toBeTruthy();
    expect(screen.getByText("rank-1-current-1")).toBeTruthy();
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

    expect(screen.getByText("level-3")).toBeTruthy();
    expect(screen.getByText("250 XP total")).toBeTruthy();
    expect(screen.getByText("rank-3-current-3")).toBeTruthy();
    expect(screen.queryByText("rank-1-current-1")).toBeNull();
  });

  it("renders hero, catalog and back action for loaded progression", () => {
    const state = overview({
      progression: {
        current_level: 1,
        xp_total: 25,
        xp_to_next_level: 25,
        progress_percent: 50,
      },
      levelCatalog: sampleCatalog,
    });
    const actions = renderContent(state, true);

    expect(screen.getByText("level-1")).toBeTruthy();
    expect(screen.getByText("rank-1-current-1")).toBeTruthy();
    expect(screen.getByText("rank-2-current-1")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Back").at(-1)!);
    expect(actions.onBack).toHaveBeenCalledTimes(1);
  });
});
