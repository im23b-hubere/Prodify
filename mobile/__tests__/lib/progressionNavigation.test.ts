import {
  leaveProgressionOverview,
  parseProgressionOverviewFrom,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";

describe("progressionNavigation", () => {
  it("builds href with from param", () => {
    expect(progressionOverviewHref("dashboard")).toEqual({
      pathname: "/progression-overview",
      params: { from: "dashboard" },
    });
  });

  it("parses from param with dashboard fallback", () => {
    expect(parseProgressionOverviewFrom("stats")).toBe("stats");
    expect(parseProgressionOverviewFrom(undefined)).toBe("dashboard");
    expect(parseProgressionOverviewFrom(["friends"])).toBe("friends");
  });

  it("pops back to the tab that opened the overview", () => {
    const back = jest.fn();
    leaveProgressionOverview(
      { back, canGoBack: () => true, dismissTo: jest.fn() },
      "profile",
    );
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("pops to that tab when the overview was opened with no history", () => {
    const dismissTo = jest.fn();
    leaveProgressionOverview(
      { back: jest.fn(), canGoBack: () => false, dismissTo },
      "profile",
    );
    expect(dismissTo).toHaveBeenCalledWith("/(tabs)/profile");
  });
});
