import { render, screen } from "@testing-library/react-native";

import { YourWeekCard } from "../../components/stats/YourWeekCard";

const t = (key: string, params?: Record<string, unknown>) => {
  if (params) return `${key}:${JSON.stringify(params)}`;
  return key;
};

describe("YourWeekCard", () => {
  it("renders hero variant with next step and without studio days", () => {
    render(
      <YourWeekCard
        t={t as never}
        goal={{
          goal_type: "weekly_sessions",
          target_value: 5,
          week_start: "2026-06-23",
          current_sessions: 2,
          progress_percent: 40,
        }}
        forecast={{
          week_start: "2026-06-23",
          target_sessions: 5,
          completed_sessions: 2,
          remaining_sessions: 3,
          days_left: 4,
          required_sessions_per_day: 1,
          risk_level: "on_track",
          warning_message: "",
        }}
        commitment={null}
        heatmapDays={[]}
        configured
        busy={false}
        hero
        onSaveGoal={jest.fn()}
        onStartSession={jest.fn()}
      />,
    );

    expect(screen.getByTestId("your-week-hero")).toBeTruthy();
    expect(screen.getByText("stats.yourWeek.nextStepRemaining:{\"n\":3}")).toBeTruthy();
    expect(screen.queryByText("stats.yourWeek.studioDays")).toBeNull();
  });
});
