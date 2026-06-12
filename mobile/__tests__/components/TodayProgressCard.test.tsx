import { fireEvent, render, screen } from "@testing-library/react-native";

import { TodayProgressCard } from "../../components/dashboard/TodayProgressCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("TodayProgressCard", () => {
  it("renders today sessions and minutes only", () => {
    render(<TodayProgressCard todaySessions={2} todayMinutes={90} />);

    expect(screen.getByText("todayProgress.title")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.queryByText("todayProgress.weekGoal")).toBeNull();
    expect(screen.queryByText("todayProgress.weekOnly")).toBeNull();
  });

  it("shows Stats link when onViewWeekInStats is provided", () => {
    const onViewWeekInStats = jest.fn();
    render(
      <TodayProgressCard
        todaySessions={1}
        todayMinutes={45}
        onViewWeekInStats={onViewWeekInStats}
      />,
    );

    fireEvent.press(screen.getByText("dashboard.viewWeekInStats"));
    expect(onViewWeekInStats).toHaveBeenCalledTimes(1);
  });
});
