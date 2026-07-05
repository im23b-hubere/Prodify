import { render, screen } from "@testing-library/react-native";

import { SessionShareImageModal } from "../../components/session/SessionShareImageModal";
import type { SessionDto } from "../../types/session";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-view-shot", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function ViewShot(
      props: { children: React.ReactNode },
      ref: React.Ref<{ capture?: () => Promise<string> }>,
    ) {
      React.useImperativeHandle(ref, () => ({
        capture: async () => "file:///mock.png",
      }));
      return <View>{props.children}</View>;
    }),
  };
});

jest.mock("../../components/ui/PrimaryButton", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock("../../components/session/SessionShareStoryCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    STORY_CAPTURE_WIDTH: 1080,
    STORY_CAPTURE_HEIGHT: 1920,
    SessionShareStoryCard: () => <Text>story-card</Text>,
  };
});

const session: SessionDto = {
  id: 1,
  session_type: "beat_making",
  duration_seconds: 1800,
  focus_score: 82,
  started_at: "2026-06-01T10:00:00Z",
  stopped_at: "2026-06-01T10:30:00Z",
  notes: null,
  mood_level: null,
  tags: [],
  user_id: 1,
};

describe("SessionShareImageModal", () => {
  it("renders English i18n copy instead of hardcoded strings", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    expect(screen.getByText("sessionInsights.shareModalTitle")).toBeTruthy();
    expect(screen.getByText("sessionInsights.shareModalSubtitle")).toBeTruthy();
    expect(screen.getByText("sessionInsights.shareTemplateMinimal")).toBeTruthy();
    expect(screen.getByText("sessionInsights.shareTemplateBold")).toBeTruthy();
    expect(screen.getByText("sessionInsights.shareTemplateGradient")).toBeTruthy();
    expect(screen.getByText("sessionInsights.sharePngCta")).toBeTruthy();
    expect(screen.getByText("sessionInsights.shareClose")).toBeTruthy();
  });
});
