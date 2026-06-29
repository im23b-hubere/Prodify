import { render, screen } from "@testing-library/react-native";

import { DashboardMotivationCard } from "../../components/dashboard/DashboardMotivationCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && "count" in opts ? `${key}:${opts.count}` : key,
  }),
}));

jest.mock("../../components/ui/GlassCard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassCard: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe("DashboardMotivationCard", () => {
  it("prefers server message over local message", () => {
    render(
      <DashboardMotivationCard
        greeting="Hey"
        userName="Eric"
        message="Local motivation"
        serverMessage="Server motivation"
        todaySessionCount={0}
      />,
    );

    expect(screen.getByText("Server motivation")).toBeTruthy();
    expect(screen.queryByText("Local motivation")).toBeNull();
  });

  it("falls back to local message when server message is empty", () => {
    render(
      <DashboardMotivationCard
        greeting="Hey"
        userName="Eric"
        message="Local motivation"
        serverMessage="   "
        todaySessionCount={2}
      />,
    );

    expect(screen.getByText("Local motivation")).toBeTruthy();
    expect(screen.getByText("motivationCard.sessionsToday:2")).toBeTruthy();
  });
});
