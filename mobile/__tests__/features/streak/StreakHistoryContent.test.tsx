import { fireEvent, render, screen } from "@testing-library/react-native";

import { StreakHistoryContent } from "../../../features/streak/components/StreakHistoryContent";
import type { StreakHistoryState } from "../../../features/streak/hooks/useStreakHistory";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function history(overrides: Partial<StreakHistoryState> = {}): StreakHistoryState {
  return {
    runs: [],
    currentStreak: null,
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    retry: jest.fn(),
    ...overrides,
  };
}

function renderContent(state: StreakHistoryState, signedIn: boolean) {
  const onSignIn = jest.fn();
  const onStartSession = jest.fn();
  render(
    <StreakHistoryContent
      history={state}
      signedIn={signedIn}
      onSignIn={onSignIn}
      onStartSession={onStartSession}
    />,
  );
  return { onSignIn, onStartSession };
}

describe("StreakHistoryContent", () => {
  it("offers sign-in without exposing authenticated empty actions", () => {
    const actions = renderContent(history(), false);

    fireEvent.press(screen.getByText("streakHistory.signInCta"));
    expect(actions.onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("streakHistory.emptyCta")).toBeNull();
  });

  it("shows errors with retry", () => {
    const state = history({ error: "History unavailable" });
    renderContent(state, true);

    expect(screen.getByText("History unavailable")).toBeTruthy();
    fireEvent.press(screen.getByText("common.tryAgain"));
    expect(state.retry).toHaveBeenCalledTimes(1);
  });

  it("offers a new session for an empty authenticated history", () => {
    const actions = renderContent(history(), true);

    fireEvent.press(screen.getByText("streakHistory.emptyCta"));
    expect(actions.onStartSession).toHaveBeenCalledTimes(1);
  });

  it("renders run progress and the history footnote", () => {
    renderContent(
      history({
        currentStreak: 3,
        runs: [{ start_date: "2026-08-11", end_date: "2026-08-13", length_days: 3 }],
      }),
      true,
    );

    expect(screen.getByText("3 streakHistory.dayUnit")).toBeTruthy();
    expect(screen.getByText("streakHistory.currentBadge")).toBeTruthy();
    expect(screen.getByText("streakHistory.footnote")).toBeTruthy();
  });
});
