import { render, screen } from "@testing-library/react-native";

import { TodayProgressCard } from "../../components/dashboard/TodayProgressCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

describe("TodayProgressCard", () => {
  it("renders today sessions and minutes in full mode", () => {
    render(<TodayProgressCard todaySessions={2} todayMinutes={90} />);

    expect(screen.getByText("todayProgress.title")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
  });

  it("renders compact summary when compact is true", () => {
    render(<TodayProgressCard todaySessions={1} todayMinutes={45} compact />);

    expect(screen.getByTestId("today-progress-compact")).toBeTruthy();
    expect(
      screen.getByText('todayProgress.compactSummary:{"sessions":1,"minutes":45}'),
    ).toBeTruthy();
  });
});
