import { fireEvent, render, screen } from "@testing-library/react-native";

import { SessionInsightSections } from "../../components/session/SessionInsightSections";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

const session = {
  id: 1,
  user_id: 1,
  session_type: "beat_making",
  started_at: "2026-08-10T10:00:00Z",
  stopped_at: "2026-08-10T10:30:00Z",
  duration_seconds: 1800,
  notes: "Focused",
  mood_level: 4,
} satisfies SessionDto;

const insights: SessionDetailInsightsDto = {
  impact_lines: ["fallback impact"],
  impact_items: [{ key: "focus", params: { score: 80 } }],
  focus_score: 80,
  focus_label: "Strong",
  focus_percentile: 70,
  active_seconds: 1500,
  paused_seconds: 300,
  effective_rate_percent: 83,
  timeline: [
    { kind: "active", seconds: 1500 },
    { kind: "paused", seconds: 300 },
  ],
  productivity_insights: ["fallback productivity"],
  related_sessions: [
    {
      id: 9,
      session_type: "writing",
      duration_seconds: 1200,
      started_at: "2026-08-09T10:00:00Z",
    },
  ],
};

describe("SessionInsightSections", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses translated insight items and fallback productivity lines", () => {
    render(<SessionInsightSections session={session} insights={insights} />);

    expect(screen.queryByText("fallback impact")).toBeNull();
    expect(screen.getByText('sessionInsights.api.focus:{"score":80}')).toBeTruthy();
    expect(screen.getByText("fallback productivity")).toBeTruthy();
  });

  it("opens a related session", () => {
    render(<SessionInsightSections session={session} insights={insights} />);

    fireEvent.press(screen.getByRole("link"));
    expect(mockPush).toHaveBeenCalledWith("/session/9");
  });
});
