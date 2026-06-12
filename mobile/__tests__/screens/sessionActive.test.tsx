import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionActiveScreen from "../../app/session/active";

const mockReplace = jest.fn();
const mockApiJson = jest.fn();
const mockRouter = {
  replace: mockReplace,
  back: jest.fn(),
  push: jest.fn(),
  dismiss: jest.fn(),
  canDismiss: () => false,
  canGoBack: () => false,
};

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Gesture: {
      Pan: () => ({
        enabled: () => ({
          activeOffsetY: () => ({
            failOffsetX: () => ({
              onUpdate: () => ({
                onEnd: () => ({}),
              }),
            }),
          }),
        }),
      }),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (fn: () => object) => fn();
  Reanimated.withRepeat = (value: unknown) => value;
  Reanimated.withSequence = (...values: unknown[]) => values[0];
  Reanimated.withTiming = (value: unknown) => value;
  Reanimated.runOnJS = (fn: (...args: unknown[]) => unknown) => fn;
  return Reanimated;
});

const translate = (key: string) => key;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "7", source: "dashboard" }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

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

describe("SessionActiveScreen error recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockRejectedValue(new Error("load failed"));
  });

  it("shows retry and back actions when active session fails to load", async () => {
    const { getByText } = render(<SessionActiveScreen />);

    await waitFor(() => {
      expect(getByText("load failed")).toBeTruthy();
      expect(getByText("common.tryAgain")).toBeTruthy();
      expect(getByText("common.back")).toBeTruthy();
    });

    const callsBeforeRetry = mockApiJson.mock.calls.length;
    fireEvent.press(getByText("common.tryAgain"));
    await waitFor(() => {
      expect(mockApiJson.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });

    await waitFor(() => {
      expect(getByText("load failed")).toBeTruthy();
      expect(getByText("common.back")).toBeTruthy();
    });
    fireEvent.press(getByText("common.back"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });
});
