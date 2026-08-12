import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import { SessionDetailHero } from "../../../features/sessions/components/SessionDetailHero";
import type { SessionDto } from "../../../types/session";

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
      <View testID={testID}>{children}</View>
    ),
  };
});

const t = ((key: string) => key) as unknown as TFunction;
const session = {
  id: 12,
  user_id: 2,
  session_type: "beat_making",
  started_at: "2026-08-10T10:00:00Z",
  stopped_at: "2026-08-10T10:30:00Z",
  duration_seconds: 1800,
  notes: null,
  track_outcome: "finished",
  track_title: "Night Drive",
} satisfies SessionDto;

function renderHero(overrides: Partial<ComponentProps<typeof SessionDetailHero>> = {}) {
  const props: ComponentProps<typeof SessionDetailHero> = {
    t,
    session,
    durationLabel: "30 min",
    dateLine: "10 Aug",
    isOwnSession: false,
    isActiveSession: false,
    producerDisplayName: "Mia",
    focusScore: 88,
    trackOutcomeLabel: "Completed",
    onShareStory: jest.fn(),
    onResumeActive: jest.fn(),
    onOpenProfile: jest.fn(),
    ...overrides,
  };
  render(<SessionDetailHero {...props} />);
  return props;
}

describe("SessionDetailHero", () => {
  it("keeps friend profile and both share actions available", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const props = renderHero();

    fireEvent.press(screen.getByLabelText("sessionDetail.viewProfileA11y"));
    fireEvent.press(screen.getByLabelText("sessionDetail.shareSessionImage"));
    fireEvent.press(screen.getByLabelText("sessionDetail.shareSession"));

    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(props.onShareStory).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ message: "sessionDetail.shareSessionMessage" }),
    );
  });

  it("shows only the resume action for an active own session", () => {
    const props = renderHero({ isOwnSession: true, isActiveSession: true });

    fireEvent.press(screen.getByText("sessionDetail.returnToActive"));
    expect(props.onResumeActive).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("sessionDetail.shareSession")).toBeNull();
    expect(screen.queryByLabelText("sessionDetail.viewProfileA11y")).toBeNull();
  });
});
