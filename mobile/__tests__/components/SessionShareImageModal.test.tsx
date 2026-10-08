import * as ImagePicker from "expo-image-picker";
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
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const chainable: object = new Proxy({}, { get: () => () => chainable });
  return {
    Gesture: { Pan: () => chainable },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
  };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: () => null,
    Polyline: () => null,
    SvgXml: ({ xml }: { xml: string }) => <Text>{xml.slice(0, 40)}</Text>,
  };
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

const CARD = "Production session. eric. 107 minutes.";
/** Opening the sheet draws the first card and its neighbour; the rest are drawn as you swipe. */
const DRAWN_ON_OPEN = 2;

function swipeTo(page: number) {
  const carousel = screen.getByLabelText("sessionInsights.shareSwipeA11y");
  fireEvent(carousel, "layout", { nativeEvent: { layout: { width: 400, height: 500 } } });
  fireEvent(carousel, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: page * 400, y: 0 } },
  });
}

describe("SessionShareImageModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows every style as a swipeable card, starting on Isometric", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    expect(screen.getByText("sessionInsights.shareModalTitle")).toBeTruthy();
    expect(screen.getAllByLabelText(CARD)).toHaveLength(DRAWN_ON_OPEN);
    expect(screen.queryByLabelText("sessionInsights.shareClose")).toBeNull();
    expect(screen.getByText("sessionInsights.shareTemplateIsometric")).toBeTruthy();
    for (const key of ["Photo", "Transparent", "Mono", "Timeline", "Isometric", "Echo"]) {
      expect(screen.getByLabelText(`sessionInsights.shareTemplate${key}`)).toBeTruthy();
    }
  });

  it("follows swipes and dot taps to the chosen style", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    swipeTo(2);
    expect(screen.getByText("sessionInsights.shareTemplateTimeline")).toBeTruthy();
    expect(screen.getAllByLabelText(CARD).length).toBeGreaterThan(DRAWN_ON_OPEN);
    fireEvent.press(screen.getByLabelText("sessionInsights.shareTemplateMono"));
    expect(screen.getByLabelText("sessionInsights.shareMonoLight")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("sessionInsights.shareTemplateTransparent"));
    expect(screen.queryByLabelText("sessionInsights.shareMonoLight")).toBeNull();
  });

  it("starts over on Isometric after closing on another style", () => {
    const view = render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    swipeTo(3);
    expect(screen.getByText("sessionInsights.shareTemplateEcho")).toBeTruthy();
    view.rerender(
      <SessionShareImageModal
        visible={false}
        onClose={jest.fn()}
        session={session}
        producerName="eric"
      />,
    );
    view.rerender(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );
    expect(screen.getByText("sessionInsights.shareTemplateIsometric")).toBeTruthy();
    expect(screen.queryByText("sessionInsights.shareTemplateEcho")).toBeNull();
  });

  it("forgets the picked photo once the sheet is closed", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///studio.jpg", width: 1080, height: 1920 }],
    });
    const view = render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    swipeTo(5);
    fireEvent.press(screen.getAllByText("sessionInsights.sharePickPhoto").at(-1)!);
    expect(await screen.findAllByText("sessionInsights.shareChangePhoto")).not.toHaveLength(0);
    view.rerender(
      <SessionShareImageModal
        visible={false}
        onClose={jest.fn()}
        session={session}
        producerName="eric"
      />,
    );
    view.rerender(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );
    swipeTo(5);
    expect(screen.queryByText("sessionInsights.shareChangePhoto")).toBeNull();
    expect(screen.getAllByText("sessionInsights.sharePickPhoto").length).toBeGreaterThan(0);
  });

  it("asks for a photo instead of sharing an empty Photo card", async () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    swipeTo(5);
    fireEvent.press(screen.getAllByText("sessionInsights.sharePickPhoto").at(-1)!);
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("captures and shares the story image once the export card has laid out", async () => {
    jest.useFakeTimers();
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    fireEvent.press(screen.getByText("sessionInsights.sharePngCta"));
    const cards = screen.getAllByLabelText(CARD);
    expect(cards).toHaveLength(DRAWN_ON_OPEN + 1);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    fireEvent(cards.at(-1)!, "layout", { nativeEvent: { layout: { width: 360, height: 640 } } });
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

  it("steps through the styles with the side arrows, hiding them at either end", () => {
    render(
      <SessionShareImageModal visible onClose={jest.fn()} session={session} producerName="eric" />,
    );

    expect(screen.queryByLabelText("sessionInsights.sharePreviousStyle")).toBeNull();
    fireEvent.press(screen.getByLabelText("sessionInsights.shareNextStyle"));
    expect(screen.getByText("sessionInsights.shareTemplateMono")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("sessionInsights.sharePreviousStyle"));
    expect(screen.getByText("sessionInsights.shareTemplateIsometric")).toBeTruthy();

    swipeTo(5);
    expect(screen.queryByLabelText("sessionInsights.shareNextStyle")).toBeNull();
  });
});
