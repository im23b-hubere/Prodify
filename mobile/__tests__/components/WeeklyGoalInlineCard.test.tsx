import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { WeeklyGoalInlineCard } from "../../components/dashboard/WeeklyGoalInlineCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "Light" },
}));

describe("WeeklyGoalInlineCard", () => {
  it("renders setup chips and saves on tap", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<WeeklyGoalInlineCard mode="setup" onSave={onSave} />);

    expect(screen.getByTestId("weekly-goal-inline-setup")).toBeTruthy();
    expect(screen.getByText("dashboard.weeklyGoalNudgeTitle")).toBeTruthy();
    fireEvent.press(screen.getByText("5"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(5));
  });

  it("renders progress bar when goal exists", () => {
    render(<WeeklyGoalInlineCard mode="progress" current={2} target={5} />);

    expect(screen.getByTestId("weekly-goal-inline-progress")).toBeTruthy();
    expect(
      screen.getByText('dashboard.weeklyGoalProgress:{"current":2,"target":5}'),
    ).toBeTruthy();
  });

  it("shows edit chips when edit is pressed", () => {
    const onChangeTarget = jest.fn().mockResolvedValue(undefined);
    render(
      <WeeklyGoalInlineCard
        mode="progress"
        current={3}
        target={5}
        onChangeTarget={onChangeTarget}
      />,
    );

    fireEvent.press(screen.getByText("dashboard.weeklyGoalEdit"));
    expect(screen.getByText("7")).toBeTruthy();
  });
});
