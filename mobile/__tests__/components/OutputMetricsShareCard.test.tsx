import { render, screen } from "@testing-library/react-native";

import { OutputMetricsShareCard } from "../../components/outcomes/OutputMetricsShareCard";
import type { OutputMetricsDto } from "../../types/outcomes";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const metrics: OutputMetricsDto = {
  tracks_finished_30d: 4,
  avg_completion_time_days: 3,
  release_consistency: 80,
  productivity_trend: "up",
  vs_previous_month: 25,
  days_using: 40,
  completed_tracks: 12,
  consistency_improvement: 10,
  output_increase: 25,
  baseline_tracks_30d: 3,
};

describe("OutputMetricsShareCard", () => {
  it.each([
    ["minimal", "stats.shareProofCardMinimalTitle"],
    ["bold", "stats.shareProofCardBoldTitle"],
    ["gradient", "stats.shareProofCardGradientTitle"],
  ] as const)("renders the %s template", (template, title) => {
    render(<OutputMetricsShareCard metrics={metrics} template={template} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText("Prodify")).toBeTruthy();
  });

  it("renders the resolved productivity trend in the gradient template", () => {
    render(<OutputMetricsShareCard metrics={metrics} template="gradient" />);

    expect(screen.getByText("stats.shareProofTrendUp")).toBeTruthy();
  });
});
