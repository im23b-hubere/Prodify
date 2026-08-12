import { weeklyQuestPresentation } from "../../components/studio/weeklyQuestPresentation";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

function feedback(overrides: Partial<SessionFeedbackComputed> = {}): SessionFeedbackComputed {
  return {
    remainingSessionsToGoal: 2,
    progressPercent: 40,
    newStatus: "on_track",
    ...overrides,
  } as SessionFeedbackComputed;
}

function forecast(overrides: Partial<ForecastComputed>): ForecastComputed {
  return {
    forecastStatus: "on_track",
    currentProgressPercent: 40,
    ...overrides,
  } as ForecastComputed;
}

describe("weekly quest presentation", () => {
  it("prioritizes goal completion over the pace forecast", () => {
    expect(
      weeklyQuestPresentation(
        feedback({ remainingSessionsToGoal: 0 }),
        forecast({ forecastStatus: "will_miss" }),
      ).status,
    ).toBe("goalComplete");
  });

  it.each([
    ["ahead", "ahead"],
    ["at_risk", "atRisk"],
    ["will_miss", "atRisk"],
  ] as const)("maps %s forecasts to %s", (forecastStatus, expected) => {
    expect(weeklyQuestPresentation(feedback(), forecast({ forecastStatus })).status).toBe(expected);
  });

  it("uses feedback status without a forecast and clamps progress", () => {
    expect(
      weeklyQuestPresentation(feedback({ newStatus: "off_track", progressPercent: 140 }), null),
    ).toEqual({ status: "offTrack", progressPercent: 100 });
    expect(weeklyQuestPresentation(feedback({ progressPercent: -10 }), null).progressPercent).toBe(
      0,
    );
  });
});
