import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { ProfileScreenView } from "../../../features/profile/components/ProfileScreenView";
import type { ProfileScreenController } from "../../../features/profile/hooks/useProfileScreenController";

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  BarChart3: () => null,
  Bell: () => null,
  Camera: () => null,
  ChevronRight: () => null,
  FileText: () => null,
  LogOut: () => null,
  Settings: () => null,
  Shield: () => null,
  Trash2: () => null,
  Trophy: () => null,
}));

jest.mock("../../../components/ui/AppCard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppCard: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, props, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  };
});

jest.mock("../../../components/icons/ProdifyGlyphs", () => ({
  AppFlame: () => null,
  glyphRowStyle: {},
}));

jest.mock("../../../components/progression/RankCard", () => ({
  RankCard: () => null,
}));

jest.mock("../../../features/stats/components/StatsHeatmapSection", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    StatsHeatmapSection: () =>
      React.createElement(
        View,
        { testID: "stats-section-heatmap" },
        React.createElement(Text, null, "heatmap"),
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
      heatmapDays: [],
      loading: true,
      refreshing: false,
      error: null,
      load: action,
      refresh: action,
      ...dataOverrides,
    },
    profilePicture: {
      busy: false,
      pickAndUpload: action,
    },
    navigation: {
      openPublicProfile: action,
      openStats: action,
      openProgression: action,
      openSettings: action,
    },
  };
}

describe("ProfileScreenView", () => {
  it("opens settings from the gear while profile data initially loads", () => {
    const controller = createController();
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByTestId("profile-identity-card")).toBeTruthy();
    expect(screen.getByTestId("profile-quick-actions")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("profile.openSettingsA11y"));
    expect(controller.navigation.openSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps settings out of the page itself", () => {
    const screen = render(<ProfileScreenView controller={createController()} />);

    expect(screen.queryByLabelText("profile.signOut")).toBeNull();
    expect(screen.queryByLabelText("legal.deleteAccount.button")).toBeNull();
  });

  it("keeps milestones and the settings gear available after a total data error", () => {
    const controller = createController({ loading: false, error: "offline" });
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByText("profile.milestonesUnavailable")).toBeTruthy();
    expect(screen.getByLabelText("profile.openSettingsA11y")).toBeTruthy();
  });

  it("shows activity heatmap in the producer snapshot", () => {
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
    });
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByTestId("stats-section-heatmap")).toBeTruthy();
    expect(screen.getByText("profile.producerSnapshotTitle")).toBeTruthy();
  });

  it("shows the signed-in email under the username", () => {
    const controller = createController({ loading: false });
    controller.user = {
      id: 7,
      email: "producer@example.com",
      username: "producer",
    };
    const screen = render(<ProfileScreenView controller={controller} />);

    expect(screen.getByText("producer@example.com")).toBeTruthy();
    expect(screen.getByLabelText("profile.signedInEmail")).toBeTruthy();
  });
});
