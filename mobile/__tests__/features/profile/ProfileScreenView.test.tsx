import React from "react";
import { render } from "@testing-library/react-native";

import { ProfileScreenView } from "../../../features/profile/components/ProfileScreenView";
import type { ProfileScreenController } from "../../../features/profile/hooks/useProfileScreenController";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("../../../components/progression/RankHudChip", () => ({
  RankHudChip: () => null,
}));

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
});
