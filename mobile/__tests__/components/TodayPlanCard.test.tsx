import { fireEvent, render, screen } from "@testing-library/react-native";

import { TodayPlanCard } from "../../components/dashboard/TodayPlanCard";
import type { TodayPlanRecommendation } from "../../lib/todayPlanEngine";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

const basePlan: TodayPlanRecommendation = {
  status: "on_track",
  messageKey: "todayPlan.recommendation.onTrack",
  messageParams: { sessions: 1, minutes: 45 },
  suggestedSessionType: "beat_making",
  suggestedSessionsToday: 1,
  suggestedDurationMin: 45,
  feedbackPreview: null,
};

describe("TodayPlanCard", () => {
  it("renders recommendation and start CTA without a week forecast block", () => {
    const onStartSuggested = jest.fn();
    render(
      <TodayPlanCard
        plan={basePlan}
        onStartSuggested={onStartSuggested}
      />,
    );

    expect(screen.getByText("todayPlan.title")).toBeTruthy();
    expect(
      screen.getByText('todayPlan.recommendation.onTrack:{"sessions":1,"minutes":45}'),
    ).toBeTruthy();
    expect(screen.getByText("todayPlan.cta")).toBeTruthy();
    expect(screen.queryByText("todayPlan.preview")).toBeNull();
  });

  it("calls onStartSuggested when CTA is pressed", () => {
    const onStartSuggested = jest.fn();
    render(<TodayPlanCard plan={basePlan} onStartSuggested={onStartSuggested} />);

    fireEvent.press(screen.getByText("todayPlan.cta"));
    expect(onStartSuggested).toHaveBeenCalledTimes(1);
  });
});
