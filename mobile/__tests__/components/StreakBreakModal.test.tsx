import { fireEvent, render, screen } from "@testing-library/react-native";

import { StreakBreakModal } from "../../components/streak/StreakBreakModal";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "days" in opts) return `${key}:${opts.days}`;
      return key;
    },
  }),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Error: "Error" },
}));

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            unloadAsync: jest.fn(() => Promise.resolve()),
            stopAsync: jest.fn(() => Promise.resolve()),
          },
        }),
      ),
    },
  },
}));

jest.mock("lottie-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => <View testID="lottie" />,
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

describe("StreakBreakModal", () => {
  it("renders i18n copy and calls onStartFresh when dismissed", () => {
    const onStartFresh = jest.fn();
    render(<StreakBreakModal visible brokenStreak={5} onStartFresh={onStartFresh} />);

    expect(screen.getByText("streakBreak.title:5")).toBeTruthy();
    expect(screen.getByText("streakBreak.subtitle")).toBeTruthy();
    expect(screen.getByText("streakBreak.achievement:5")).toBeTruthy();

    fireEvent.press(screen.getByText("streakBreak.startFresh"));
    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });
});
