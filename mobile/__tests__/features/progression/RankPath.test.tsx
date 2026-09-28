import { render, screen } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { RankPath } from "../../../features/progression/components/RankPath";
import { buildRankPathLayout } from "../../../features/progression/rankPathLayout";

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key) as unknown as TFunction;

// Rank labels are hidden from screen readers; the node itself carries the spoken label.
const HIDDEN = { includeHiddenElements: true };

function renderPath(currentLevel: number) {
  render(
    <RankPath
      layout={buildRankPathLayout(390)}
      currentLevel={currentLevel}
      progressPercent={40}
      xpTotal={3680}
      xpToNext={120}
      levelCatalog={[{ level: 12, xp_start: 6050, xp_end_exclusive: 7200, xp_span: 1150 }]}
      t={t}
    />,
  );
}

describe("RankPath", () => {
  it("marks cleared, current, next and locked ranks", () => {
    renderPath(7);

    expect(screen.getByText("progression.path.youAreHere")).toBeTruthy();
    expect(
      screen.getByLabelText(/"level":6,.*"status":"progression.path.status.cleared"/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/"level":7,.*"status":"progression.path.status.current"/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/"level":8,.*"status":"progression.path.status.next"/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/"level":9,.*"status":"progression.path.status.locked"/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /progression.path.currentLine .*"xp":"3,680","target":"3,800","toGo":"120"/,
        HIDDEN,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/progression.path.nextLine .*"level":8/, HIDDEN)).toBeTruthy();
    expect(screen.getByText(/progression.path.lockedLine .*"level":12/, HIDDEN)).toBeTruthy();
  });

  it("shows reached tier gates as unlocked and the rest locked", () => {
    renderPath(7);

    expect(screen.getByText(/progression.path.tierRange .*"from":5/)).toBeTruthy();
    expect(screen.getByText(/progression.path.tierRange .*"from":17/)).toBeTruthy();
    expect(screen.getByText("progression.path.finalRank", HIDDEN)).toBeTruthy();
    expect(screen.getByText("progression.path.start")).toBeTruthy();
  });

  it("shows the summit as max rank for a top-level user", () => {
    renderPath(20);

    expect(screen.getByText(/progression.path.maxLine .*"xp":"3,680"/, HIDDEN)).toBeTruthy();
    expect(screen.queryByText(/progression.path.nextLine/, HIDDEN)).toBeNull();
  });
});
