import { ui } from "../../../constants/theme";
import { buildDashboardListScrollLayout } from "../../../features/dashboard/dashboardListScrollLayout";

describe("buildDashboardListScrollLayout", () => {
  it("keeps the list flex-bounded and clears the tab bar for a single session", () => {
    const layout = buildDashboardListScrollLayout({
      bottomInset: 34,
      recentSessionCount: 1,
    });

    expect(layout.style).toEqual({ flex: 1 });
    expect(layout.contentInsetAdjustmentBehavior).toBe("never");
    expect(layout.contentContainerStyle).toEqual({
      paddingHorizontal: ui.screenPadding,
      paddingBottom: 34 + ui.tabBarClearance,
    });
    expect(layout.contentContainerStyle).not.toHaveProperty("flexGrow");
  });

  it("grows empty content to fill the viewport without stretching a one-item list", () => {
    const empty = buildDashboardListScrollLayout({
      bottomInset: 0,
      recentSessionCount: 0,
    });
    const withSessions = buildDashboardListScrollLayout({
      bottomInset: 0,
      recentSessionCount: 2,
    });

    expect(empty.contentContainerStyle).toMatchObject({
      flexGrow: 1,
      paddingBottom: ui.tabBarClearance,
    });
    expect(withSessions.contentContainerStyle).not.toHaveProperty("flexGrow");
  });
});
