import { fireEvent, render, screen } from "@testing-library/react-native";

import { WeeklyGoalStatsNudge } from "../../components/dashboard/WeeklyGoalStatsNudge";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("WeeklyGoalStatsNudge", () => {
  it("renders copy and opens Stats on CTA press", () => {
    const onOpenStats = jest.fn();
    render(<WeeklyGoalStatsNudge onOpenStats={onOpenStats} />);

    expect(screen.getByText("dashboard.weeklyGoalNudgeTitle")).toBeTruthy();
    expect(screen.getByText("dashboard.weeklyGoalNudgeBody")).toBeTruthy();
    fireEvent.press(screen.getByText("dashboard.weeklyGoalNudgeCta"));
    expect(onOpenStats).toHaveBeenCalledTimes(1);
  });
});
