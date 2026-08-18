import {
  buildWeeklySharePayload,
  formatWeekRangeLabel,
} from "../../../features/weeklyRecap/weeklyRecapPresentation";
import type { TFunction } from "i18next";
import type { WeeklyReviewDto } from "../../../types/outcomes";
import { buildWrappedSlides } from "../../../features/weeklyRecap/wrappedSlides";

const t = ((key: string) => key) as TFunction;

describe("weeklyRecapPresentation", () => {
  it("rejects invalid week ranges", () => {
    expect(formatWeekRangeLabel("invalid", "2026-08-17")).toBe("");
  });

  it("only exposes trusted HTTP share URLs", () => {
    const base: WeeklyReviewDto = {
      week_start: "2026-08-10",
      week_end: "2026-08-16",
      total_sessions: 2,
      total_seconds: 3600,
      insights: [],
      blockers: [],
      suggestions: [],
      ai_feedback: "",
      share_image_url: null,
    };
    expect(
      buildWeeklySharePayload(t, { ...base, share_image_url: "javascript:bad" }, null, 2, "1.0")
        .url,
    ).toBeUndefined();
    expect(
      buildWeeklySharePayload(
        t,
        { ...base, share_image_url: "https://prodify.app/card.png" },
        null,
        2,
        "1.0",
      ).url,
    ).toBe("https://prodify.app/card.png");
  });

  it("builds an explicit empty journey ending with the outro", () => {
    const slides = buildWrappedSlides({
      t,
      review: null,
      stats: null,
      displaySessions: 0,
      displayHours: "0.0",
      weekRange: "",
    });
    expect(slides.map((slide) => slide.id)).toEqual(["intro", "empty", "outro"]);
  });
});
