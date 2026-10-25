import { apiJson } from "../../lib/client";
import { refreshStreakWidget, syncStreakWidget } from "../../lib/streakWidget";
import type { StreakWidgetEntry } from "../../lib/streakWidgetTimeline";
import type { StreakOverviewDto } from "../../types/streak";
import StreakWidget from "../../widgets/StreakWidget";

jest.mock("../../lib/client", () => ({ apiJson: jest.fn() }));
jest.mock("../../widgets/StreakWidget", () => ({
  __esModule: true,
  default: { updateTimeline: jest.fn() },
}));

const mockUpdateTimeline = StreakWidget.updateTimeline as jest.MockedFunction<
  typeof StreakWidget.updateTimeline
>;

const securedOverview: StreakOverviewDto = {
  current_streak: 12,
  longest_streak: 20,
  last_7_day_states: ["session", "session", "session", "none", "none", "none", "none"],
  last_7_day_labels: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  next_milestone_at: 14,
  next_milestone_title: "Two weeks",
  days_to_next_milestone: 2,
  freezes_remaining: 1,
  can_use_freeze: false,
  streak_at_risk: false,
  tagline: "Keep the chain",
};

const scheduledEntries = () => mockUpdateTimeline.mock.calls[0][0] as StreakWidgetEntry[];

describe("syncStreakWidget", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hands the planned streak timeline to the widget", () => {
    syncStreakWidget(securedOverview);

    expect(scheduledEntries()[0].props).toMatchObject({ streak: 12, mood: "secured" });
  });

  it("resets the widget to the start state after sign-out", () => {
    syncStreakWidget(null);

    expect(scheduledEntries().map((entry) => entry.props)).toEqual([
      expect.objectContaining({ streak: 0, mood: "start" }),
    ]);
  });

  it("re-plans the widget from the latest streak on demand", async () => {
    (apiJson as jest.Mock).mockResolvedValueOnce(securedOverview);

    await refreshStreakWidget("token");

    expect(apiJson).toHaveBeenCalledWith("/streak/overview", { token: "token" });
    expect(scheduledEntries()[0].props.mood).toBe("secured");
  });

  it("translates every headline and label the widget shows", () => {
    syncStreakWidget(securedOverview);

    for (const { props } of scheduledEntries()) {
      expect(props.headline).not.toMatch(/^streakWidget\./);
      expect(props.streakLabel).not.toMatch(/^streakHero\./);
      expect(props.week.every((day) => day.label.length > 0)).toBe(true);
    }
  });
});
