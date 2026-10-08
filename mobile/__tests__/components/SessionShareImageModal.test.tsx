import * as Sharing from "expo-sharing";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { SvgXml: ({ xml }: { xml: string }) => <Text>{xml.slice(0, 40)}</Text> };
});

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

const session: SessionDto = {
  id: 1,
  session_type: "beat_making",
  duration_seconds: 6420,
  focus_score: 82,
  started_at: "2026-10-07T10:00:00Z",
  stopped_at: "2026-10-07T11:47:00Z",
  notes: null,
  mood_level: null,
  tags: [],
  user_id: 1,
  focus_times: [{ skill_id: "beat_making.drums", assigned_seconds: 3480 }],
};

describe("SessionShareImageModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the six share templates in the existing sheet", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    expect(screen.getByText("sessionInsights.shareModalTitle")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplatePhoto")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplateTransparent")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplateBlack")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplateTimeline")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplateIsometric")).toBeTruthy();
    expect(screen.getByLabelText("sessionInsights.shareTemplateEcho")).toBeTruthy();
  });

  it("draws the selected template with the producer name", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    fireEvent.press(screen.getByLabelText("sessionInsights.shareTemplateTimeline"));
    expect(screen.getAllByLabelText("Production session. eric. 107 minutes.")).toHaveLength(1);
  });

  it("captures and shares the story image once the export card has laid out", async () => {
    jest.useFakeTimers();
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    fireEvent.press(screen.getByText("sessionInsights.sharePngCta"));
    const cards = screen.getAllByLabelText("Production session. eric. 107 minutes.");
    expect(cards).toHaveLength(2);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    fireEvent(cards[1], "layout", { nativeEvent: { layout: { width: 360, height: 640 } } });
    await act(async () => jest.advanceTimersByTime(100));
    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///mock.png", {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "sessionInsights.shareDialogTitle",
      }),
    );
    jest.useRealTimers();
  });
});
