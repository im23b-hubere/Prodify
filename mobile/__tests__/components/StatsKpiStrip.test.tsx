import { render, screen } from "@testing-library/react-native";

import { StatsKpiStrip } from "../../components/stats/StatsKpiStrip";

describe("StatsKpiStrip", () => {
  it("renders three KPI cells", () => {
    render(
      <StatsKpiStrip
        testID="stats-kpi-strip"
        items={[
          { key: "hours", label: "Hours", value: "12.5h" },
          { key: "sessions", label: "Sessions", value: "8" },
          { key: "streak", label: "Streak", value: "3" },
        ]}
      />,
    );

    expect(screen.getByTestId("stats-kpi-strip")).toBeTruthy();
    expect(screen.getByText("12.5h")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
