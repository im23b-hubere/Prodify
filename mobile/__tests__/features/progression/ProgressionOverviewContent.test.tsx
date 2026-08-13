import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProgressionOverviewContent } from "../../../features/progression/components/ProgressionOverviewContent";
import type { ProgressionOverviewState } from "../../../features/progression/hooks/useProgressionOverview";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../components/progression/LevelRankHero", () => ({
  LevelRankHeroEmblem: ({ level }: { level: number }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return <Text>{`level-${level}`}</Text>;
  },
}));
jest.mock("../../../components/progression/LevelRankRow", () => ({
  LevelRankRow: ({ entry }: { entry: { level: number } }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return <Text>{`rank-${entry.level}`}</Text>;
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

  it("shows load errors with retry", () => {
    const state = overview({ loadError: "Progress unavailable" });
    renderContent(state, true);
    fireEvent.press(screen.getByText("common.tryAgain"));
    expect(state.load).toHaveBeenCalledWith({ force: true });
  });

  it("renders hero, catalog and back action for loaded progression", () => {
    const state = overview({
      progression: {
        current_level: 1,
        xp_total: 25,
        xp_to_next_level: 25,
        progress_percent: 50,
      },
      levelCatalog: [
        { level: 1, xp_start: 0, xp_end_exclusive: 50, xp_span: 50 },
        { level: 2, xp_start: 50, xp_end_exclusive: 100, xp_span: 50 },
      ],
    });
    const actions = renderContent(state, true);

    expect(screen.getByText("level-1")).toBeTruthy();
    expect(screen.getByText("rank-1")).toBeTruthy();
    expect(screen.getByText("rank-2")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Back").at(-1)!);
    expect(actions.onBack).toHaveBeenCalledTimes(1);
  });
});
