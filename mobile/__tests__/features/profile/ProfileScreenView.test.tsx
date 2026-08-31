import React from "react";
import { render } from "@testing-library/react-native";

import { ProfileScreenView } from "../../../features/profile/components/ProfileScreenView";
import type { ProfileScreenController } from "../../../features/profile/hooks/useProfileScreenController";

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("../../../components/icons/ProdifyGlyphs", () => ({
  AppFlame: () => null,
  glyphRowStyle: {},
}));

jest.mock("../../../components/progression/RankHudChip", () => ({
  RankHudChip: () => null,
}));

jest.mock("../../../components/progression/ProgressionBarCard", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    ProgressionBarCard: ({
      progression,
      loading,
    }: {
      progression: unknown;
      loading?: boolean;
    }) =>
      React.createElement(
        View,
        {
          testID: loading
            ? "progression-bar-loading"
            : progression
              ? "progression-bar-ready"
              : "progression-bar-unavailable",
        },
        React.createElement(Text, null, loading ? "loading" : progression ? "ready" : "unavailable"),
      ),
  };
});

function createController(
  dataOverrides: Partial<ProfileScreenController["data"]> = {},
): ProfileScreenController {
  const action = jest.fn();
  return {
    t: ((key: string) => key) as ProfileScreenController["t"],
    user: null,
    data: {
      stats: null,
      milestones: null,
      reliability: null,
      heatmapDays: [],
      progression: null,
      loading: true,
      refreshing: false,
      error: null,
      load: action,
      refresh: action,
      ...dataOverrides,
    },
    accountActions: {
      confirmSignOut: action,
      confirmDeleteAccount: action,
    },
    pushTest: {
      busy: false,
      template: "test",
      selectTemplate: action,
      send: action,
    },
    navigation: {
      openPublicProfile: action,
      openStats: action,
      openProgression: action,
      openNotifications: action,
      openPrivacy: action,
      openTerms: action,
    },
  };
}

describe("ProfileScreenView", () => {
  it("keeps account settings available while profile data initially loads", () => {
    const screen = render(<ProfileScreenView controller={createController()} />);

    expect(screen.getByLabelText("profile.manageNotifications")).toBeTruthy();
    expect(screen.getByLabelText("profile.signOut")).toBeTruthy();
  });

  it("keeps milestones and account settings visible after a total data error", () => {
    const controller = createController({ loading: false, error: "offline" });
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByText("profile.milestonesUnavailable")).toBeTruthy();
    expect(screen.getByLabelText("legal.deleteAccount.button")).toBeTruthy();
  });

  it("shows unavailable progression instead of fake Level 1 when progression is missing", () => {
    const controller = createController({
      loading: false,
      error: null,
      stats: {
        period: "all",
        summary: {
          total_seconds: 3600,
          total_sessions: 2,
          avg_session_seconds: 1800,
          current_streak_days: 1,
          best_streak_days: 3,
          hours_delta_vs_prior_period: 0,
        },
        trend: [],
        breakdown: [],
        recent_sessions: [],
        productivity_hint: null,
      },
      progression: null,
    });
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByTestId("progression-bar-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("progression-bar-ready")).toBeNull();
  });
});
