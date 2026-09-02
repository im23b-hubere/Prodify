import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { DashboardWeekDots } from "../../../components/dashboard/DashboardWeekDots";
import { buildCalendarWeeksFromDays } from "../../../lib/streakCalendarWeeks";
import type { StreakOverviewDto } from "../../../types/streak";

jest.mock("lucide-react-native", () => ({
  ChevronRight: () => null,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

const LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEDNESDAY = new Date(2026, 8, 2, 12, 0, 0);

const t = ((key: string, options?: { returnObjects?: boolean }) => {
  if (options?.returnObjects && key === "dashboard.weekdayShort") return LABELS;
  if (key === "dashboard.weekStripThisWeek") return "This week";
  if (key === "dashboard.weekStripLastWeek") return "Last week";
  if (key === "dashboard.weekStripPagerA11y") return "Weekly activity. Swipe to see previous weeks.";
  if (key === "streakHero.historyA11y") return "View streak history";
  return key;
}) as TFunction;

function overviewFromDays(sessionDays: string[]): StreakOverviewDto {
  const calendar_weeks = buildCalendarWeeksFromDays(new Set(sessionDays), new Set(), LABELS, WEDNESDAY);
  const current = calendar_weeks[calendar_weeks.length - 1]!;
  return {
    current_streak: 2,
    longest_streak: 2,
    last_7_day_states: current.days.map((day) => day.state),
    last_7_day_labels: current.days.map((day) => day.label),
    calendar_weeks,
    next_milestone_at: 3,
    next_milestone_title: "Getting started",
    days_to_next_milestone: 1,
    freezes_remaining: 1,
    can_use_freeze: false,
    streak_at_risk: false,
    tagline: "Don't break the chain!",
  };
}

async function layoutPager() {
  fireEvent(screen.getByTestId("dashboard-week-strip"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 96 } },
  });
  await waitFor(() => {
    expect(screen.getByTestId("dashboard-week-pager")).toBeTruthy();
  });
}

describe("DashboardWeekDots", () => {
  it("starts on this week and exposes previous weeks after layout", async () => {
    render(
      <DashboardWeekDots
        overview={overviewFromDays(["2026-08-31", "2026-09-02"])}
        onOpenHistory={jest.fn()}
        t={t}
      />,
    );

    expect(screen.getByText("This week")).toBeTruthy();
    await layoutPager();
    expect(screen.getByTestId("dashboard-week-page-0")).toBeTruthy();
    expect(screen.getByTestId("dashboard-week-page--1")).toBeTruthy();
    expect(screen.getByTestId("dashboard-week-page--2")).toBeTruthy();
    expect(screen.getByTestId("dashboard-week-page--3")).toBeTruthy();
  });

  it("opens streak history from the chevron only", async () => {
    const onOpenHistory = jest.fn();
    render(
      <DashboardWeekDots overview={overviewFromDays(["2026-09-02"])} onOpenHistory={onOpenHistory} t={t} />,
    );

    fireEvent.press(screen.getByLabelText("View streak history"));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("updates the title when paging to last week", async () => {
    render(
      <DashboardWeekDots overview={overviewFromDays(["2026-09-02"])} onOpenHistory={jest.fn()} t={t} />,
    );
    await layoutPager();

    fireEvent(screen.getByTestId("dashboard-week-pager"), "momentumScrollEnd", {
      nativeEvent: {
        contentOffset: { x: 640, y: 0 },
        contentSize: { width: 1280, height: 80 },
        layoutMeasurement: { width: 320, height: 80 },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Last week")).toBeTruthy();
    });
  });
});
