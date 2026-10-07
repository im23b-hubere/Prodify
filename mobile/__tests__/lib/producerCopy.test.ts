import en from "../../locales/en.json";
import { translateInsightItem } from "../../lib/sessionInsightsI18n";

describe("producer-facing copy", () => {
  it("names areas, not branches, on Stats", () => {
    expect(en.stats.woranEmptyTitle).toBe("No area time yet");
    expect(en.stats.woranEmpty.toLowerCase()).toContain("area");
    expect(en.stats.woranEmpty.toLowerCase()).not.toContain("branch");
  });

  it("does not sell XP on a short session", () => {
    expect(en.sessionComplete.xpMinDurationHint).toBe(
      "Sessions under {{min}} minutes do not count toward skill time or your weekly goal.",
    );
  });

  it("keeps in-session lines factual", () => {
    expect(en.sessionActive.insightDefault).toBe("Your session is running.");
    expect(en.sessionActive.insightPastBest).toBe("Past your previous best ({{prev}}).");
  });

  it("drops emoji from streak reminders", () => {
    expect(en.streakNotifications.slot22Body).toBe(
      "Your {{count}}-day streak needs a session today — about 2 hours left.",
    );
    expect(en.streakNotifications.slot23Body).toBe(
      "One hour left today to keep your {{count}}-day streak.",
    );
    expect(en.streakNotifications.slot2330Body).toBe(
      "About 30 minutes left to keep your {{count}}-day streak.",
    );
    expect(en.streakNotifications.slot22Title).toBe("Streak at risk");
  });

  it("keeps skill-tree empty state in area and focus language", () => {
    expect(en.skillTree.emptyTitle).toBe("No skills unlocked yet");
    expect(en.skillTree.emptyBody.toLowerCase()).toContain("area");
    expect(en.skillTree.emptyBody.toLowerCase()).not.toContain("branch");
  });

  it("drops emoji and slogans from motivation api copy", () => {
    for (const line of Object.values(en.motivationApi)) {
      expect(line).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(en.motivationApi.legend).toBe("Session saved.");
  });

  it("keeps session-complete punchlines factual", () => {
    expect(en.sessionFeedback.progressFallback).toBe("Session saved.");
    expect(en.sessionFeedback.emotion.protectedStreak).toBe("That session kept your streak.");
    expect(en.sessionFeedback.emotion.strongSession).not.toMatch(/nice/i);
  });

  it("asks the producer to start a session, not protect a chain", () => {
    expect(en.dashboard.spark.atRisk).toBe("Your streak needs a session today.");
    expect(en.dashboard.spark.morning).toBe("Morning studio. Start a session.");
    expect(en.dashboard.spark.afternoon).toBe("Afternoon. The studio is open.");
    expect(en.dashboard.spark.evening).toBe("Evening studio hours.");
    expect(en.dashboard.spark.night).toBe("Late session hours.");
    expect(en.todayPlan.recommendation.streakRisk).toBe(
      "Do 1 short {{minutes}} min session today to keep your streak.",
    );
    expect(en.notificationsUi.streakRiskBody).toBe("Start a session today to keep your streak.");
  });

  it("describes peak hours without UTC", () => {
    expect(en.sessionInsights.api.prod_peak_pattern).toBe(
      "You usually start on {{weekday}} around {{hourRange}}.",
    );
    const line = translateInsightItem(
      { key: "prod_peak_pattern", params: { weekday: 1, hour: 20 } },
      ((key: string, params?: Record<string, unknown>) => {
        if (key === "common.weekdaysFull") return en.common.weekdaysFull;
        if (key === "sessionInsights.api.prod_peak_pattern") {
          return (en.sessionInsights.api.prod_peak_pattern as string)
            .replace("{{weekday}}", String(params?.weekday ?? ""))
            .replace("{{hourRange}}", String(params?.hourRange ?? ""));
        }
        return key;
      }) as never,
    );
    expect(line).not.toMatch(/UTC/i);
    expect(line).toContain("20:00–23:00");
  });
});
