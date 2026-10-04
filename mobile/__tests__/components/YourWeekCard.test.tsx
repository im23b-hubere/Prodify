import { render, screen } from "@testing-library/react-native";

import { YourWeekCard } from "../../components/stats/YourWeekCard";
import { currentWeekDateKeys } from "../../lib/weekCalendar";

const t = (key: string, params?: Record<string, unknown>) => {
  if (params) return `${key}:${JSON.stringify(params)}`;
  return key;
};

const week = currentWeekDateKeys();

function renderHero(
  heatmapDays: { date: string; seconds: number; intensity: number }[] = [],
) {
  return render(
    <YourWeekCard
      t={t as never}
      goal={{
        goal_type: "weekly_sessions",
        target_value: 5,
        week_start: week[0] ?? "2026-01-05",
        current_sessions: 2,
        progress_percent: 40,
      }}
      forecast={{
        week_start: week[0] ?? "2026-01-05",
        target_sessions: 5,
        completed_sessions: 2,
        remaining_sessions: 3,
        days_left: 4,
        required_sessions_per_day: 1,
        risk_level: "on_track",
        warning_message: "",
      }}
      commitment={null}
      heatmapDays={heatmapDays}
      configured
      busy={false}
      hero
      onSaveGoal={jest.fn()}
      onStartSession={jest.fn()}
    />,
  );
}

describe("YourWeekCard", () => {
  it("keeps the week hero and shows this week's studio days", () => {
    renderHero();

    expect(screen.getByTestId("your-week-hero")).toBeTruthy();
    expect(screen.getByText('stats.yourWeek.nextStepRemaining:{"n":3}')).toBeTruthy();
    expect(screen.getByTestId("stats-studio-days")).toBeTruthy();
    expect(screen.getByText("stats.yourWeek.studioDays")).toBeTruthy();
    expect(screen.queryByText("stats.yourWeek.fullWeek")).toBeNull();
  });

  it("labels a full counted week without treating the session goal as the win", () => {
    renderHero(week.map((date) => ({ date, seconds: 600, intensity: 2 })));

    expect(screen.getByText("stats.yourWeek.fullWeek")).toBeTruthy();
    expect(screen.queryByText("stats.yourWeek.studioDays")).toBeNull();
  });

  it("leaves a short session day empty on the week chain", () => {
    renderHero([{ date: week[0] ?? "", seconds: 60, intensity: 3 }]);

    expect(screen.getByTestId("stats-studio-day-empty-0")).toBeTruthy();
    expect(screen.queryByTestId("stats-studio-day-filled-0")).toBeNull();
  });
});
