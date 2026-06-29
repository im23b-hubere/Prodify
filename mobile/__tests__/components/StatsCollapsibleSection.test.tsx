import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { StatsCollapsibleSection } from "../../components/stats/StatsCollapsibleSection";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("StatsCollapsibleSection", () => {
  it("renders collapsed by default and expands on press", () => {
    render(
      <StatsCollapsibleSection title="Heatmap" subtitle="90 days">
        <Text>Heatmap body</Text>
      </StatsCollapsibleSection>,
    );

    expect(screen.queryByText("Heatmap body")).toBeNull();
    fireEvent.press(screen.getByText("Heatmap"));
    expect(screen.getByText("Heatmap body")).toBeTruthy();
  });

  it("starts expanded when startExpanded is true", () => {
    render(
      <StatsCollapsibleSection title="Trends" startExpanded testID="trends-section">
        <Text>Trend content</Text>
      </StatsCollapsibleSection>,
    );

    expect(screen.getByTestId("trends-section")).toBeTruthy();
    expect(screen.getByText("Trend content")).toBeTruthy();
  });
});
