import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { EngagementDebugView } from "../../../features/engagement/components/EngagementDebugView";
import type { EngagementDebug } from "../../../lib/engagementDebug";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

const establishedDebug: EngagementDebug = {
  evaluated_at: "2026-10-15T17:00:00Z",
  profile: {
    stage: 3,
    total_sessions: 24,
    avg_sessions_per_week: 4.5,
    avg_session_duration_minutes: 52,
    sessions_last_7_days: 4,
    sessions_previous_7_days: 5,
    days_since_last_session: 1,
    preferred_hours: [19, 20],
  },
  production_window: { weekdays: [0, 2, 4], start_hour: 19, end_hour: 21, is_default: false },
  preferred_notification_hour: 19,
  segment: null,
  return_probability_24h: null,
  fatigue_score: 10,
  ignored_streak: 1,
  motivation: { streak: 0.4, social: 0.3 },
  last_delivery: {
    notification_type: "streak_at_risk",
    sent_at: "2026-10-14T17:00:00Z",
    outcome: "converted",
    candidate_score: 62,
    reason: "streak at risk",
  },
  candidates: [
    {
      type: "streak_at_risk",
      category: "streak",
      title: "Your 12-day streak",
      body: "One session keeps it alive.",
      reason: "no session today, 3h left",
      total: 71,
      priority: "high",
      parts: { streak: 55, timeMatch: 25, fatigue: -10, rank: 0 },
      verdict: "send",
      is_eligible: true,
    },
  ],
  decision: {
    should_send: true,
    chosen_type: "streak_at_risk",
    score: 71,
    reason: "streak_at_risk (71) wins",
    scheduled_at: null,
  },
};

function renderView(overrides: Partial<ComponentProps<typeof EngagementDebugView>> = {}) {
  const props: ComponentProps<typeof EngagementDebugView> = {
    status: "ready",
    debug: establishedDebug,
    isEvaluating: false,
    onRetry: jest.fn(),
    onEvaluate: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
  render(<EngagementDebugView {...props} />);
  return props;
}

describe("EngagementDebugView", () => {
  it("shows a skeleton while the engine evaluates", () => {
    renderView({ status: "loading", debug: null });

    expect(screen.getByLabelText("engagementDebug.loading")).toBeTruthy();
  });

  it("offers a retry when the evaluation failed", () => {
    const props = renderView({ status: "error", debug: null });

    fireEvent.press(screen.getByText("common.retry"));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("explains the cold start before the engine knows the rhythm", () => {
    renderView({
      debug: {
        ...establishedDebug,
        profile: { ...establishedDebug.profile, stage: 1, total_sessions: 2 },
      },
    });

    expect(screen.getByText("engagementDebug.coldStartTitle")).toBeTruthy();
  });

  it("does not show the cold start notice once the profile is established", () => {
    renderView();

    expect(screen.queryByText("engagementDebug.coldStartTitle")).toBeNull();
  });

  it("explains the decision with the candidate's score parts", () => {
    renderView();

    expect(screen.getByText("streak_at_risk (71) wins")).toBeTruthy();
    expect(screen.getByText("engagementDebug.send")).toBeTruthy();
    expect(screen.getByLabelText("timeMatch: +25")).toBeTruthy();
    expect(screen.getByLabelText("fatigue: -10")).toBeTruthy();
    expect(screen.queryByLabelText("rank: 0")).toBeNull();
  });

  it("says so when no trigger applies", () => {
    renderView({
      debug: {
        ...establishedDebug,
        candidates: [],
        decision: {
          should_send: false,
          chosen_type: null,
          score: 0,
          reason: "no trigger applies",
          scheduled_at: null,
        },
      },
    });

    expect(screen.getByText("engagementDebug.noCandidates")).toBeTruthy();
    expect(screen.getByText("engagementDebug.skip")).toBeTruthy();
  });

  it("re-runs the engine on demand", () => {
    const props = renderView();

    fireEvent.press(screen.getByText("engagementDebug.evaluate"));

    expect(props.onEvaluate).toHaveBeenCalledTimes(1);
  });
});
