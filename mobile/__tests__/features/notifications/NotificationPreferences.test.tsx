import { render, screen } from "@testing-library/react-native";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import { NotificationPreferences } from "../../../features/notifications/NotificationPreferences";
import type { NotificationPreferencesState } from "../../../features/notifications/useNotificationPreferences";

jest.mock("../../../components/ui/SwipeSheet", () => {
  const { View } = require("react-native");
  return {
    SwipeSheet: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
      <View>
        {header}
        {children}
      </View>
    ),
  };
});

const t = ((key: string) => key) as unknown as TFunction;

const server: NotificationPreferencesState = {
  preferences: {
    smart_enabled: true,
    streak: true,
    social: true,
    challenge: true,
    rank: true,
    reengagement: true,
    quiet_start_minute: 1350,
    quiet_end_minute: 480,
  },
  status: "ready",
  saveFailed: false,
  update: jest.fn(),
  retry: jest.fn(),
} as unknown as NotificationPreferencesState;

describe("NotificationPreferences", () => {
  it("explains how activity patterns personalise reminders", () => {
    render(
      <NotificationPreferences
        t={t}
        visible
        onClose={jest.fn()}
        settings={{
          streak: true,
          achievements: true,
          social: true,
          tips: true,
          quietStartMinute: 1350,
          quietEndMinute: 480,
          frequency: "all",
        }}
        onUpdate={jest.fn()}
        server={server}
      />,
    );

    expect(screen.getByText("notificationsUi.personalisationNotice")).toBeTruthy();
  });
});
