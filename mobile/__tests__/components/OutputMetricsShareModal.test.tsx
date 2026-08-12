import * as Sharing from "expo-sharing";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { OutputMetricsShareModal } from "../../components/outcomes/OutputMetricsShareModal";
import type { OutputMetricsDto } from "../../types/outcomes";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
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
      React.useImperativeHandle(ref, () => ({ capture: async () => "file:///output.png" }));
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

jest.mock("../../components/outcomes/OutputMetricsShareCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    OUTPUT_SHARE_WIDTH: 360,
    OUTPUT_SHARE_HEIGHT: 640,
    OutputMetricsShareCard: ({ template }: { template: string }) => (
      <Text>{`card:${template}`}</Text>
    ),
  };
});

const metrics = {
  tracks_finished_30d: 4,
  avg_completion_time_days: 3,
  release_consistency: 80,
  productivity_trend: "up",
  vs_previous_month: 25,
  days_using: 40,
  completed_tracks: 12,
  consistency_improvement: 10,
  output_increase: 25,
  baseline_tracks_30d: 3,
} satisfies OutputMetricsDto;

function renderModal() {
  return render(
    <OutputMetricsShareModal
      visible
      onClose={jest.fn()}
      metrics={metrics}
      title="Output proof"
      subtitle="Choose a style"
      shareLabel="Share"
      closeLabel="Close"
      busyLabel="Sharing"
    />,
  );
}

describe("OutputMetricsShareModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("switches the preview and capture card template together", () => {
    renderModal();

    fireEvent.press(screen.getByLabelText("stats.shareProofTemplateMinimal"));
    expect(screen.getAllByText("card:minimal")).toHaveLength(2);
  });

  it("captures and shares the selected card", async () => {
    jest.useFakeTimers();
    renderModal();
    fireEvent.press(screen.getByText("Share"));

    await act(async () => jest.advanceTimersByTime(160));
    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///output.png", {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "stats.shareProofShareDialogTitle",
      }),
    );
    jest.useRealTimers();
  });
});
