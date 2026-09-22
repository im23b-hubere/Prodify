import { render, screen } from "@testing-library/react-native";

import { StatsKpiStrip } from "../../components/stats/StatsKpiStrip";

describe("StatsKpiStrip", () => {
  it("renders three KPI cells", () => {
    render(
      <StatsKpiStrip
        testID="stats-kpi-strip"
        items={[
          { key: "hours", label: "Hours", value: "12.5h" },
          { key: "avg", label: "Avg session", value: "45m" },
          { key: "consistency", label: "Consistency", value: "43%" },
        ]}
      />,
    );

    expect(screen.getByTestId("stats-kpi-strip")).toBeTruthy();
    expect(screen.getByText("12.5h")).toBeTruthy();
    expect(screen.getByText("45m")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
  });
});
