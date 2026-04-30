import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import OnboardingScreen from "../../app/onboarding/index";
import { ONBOARDING_COMPLETE_KEY } from "../../constants/storageKeys";
import { apiJson } from "../../lib/client";
import { savePendingWeeklyGoal } from "../../lib/onboardingGoalSync";

const mockReplace = jest.fn();

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (fn: () => object) => fn();
  Reanimated.withRepeat = (value: unknown) => value;
  Reanimated.withSequence = (...values: unknown[]) => values[0];
  Reanimated.withTiming = (value: unknown) => value;
  Reanimated.Easing = {
    inOut: (x: unknown) => x,
    ease: jest.fn(),
    out: (x: unknown) => x,
    cubic: jest.fn(),
  };
  Reanimated.FadeInDown = { duration: () => ({}) };
  Reanimated.FadeInUp = { duration: () => ({}) };
  return Reanimated;
});

jest.mock("expo-asset", () => ({
  Asset: {
    loadAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: null }),
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

jest.mock("../../lib/onboardingGoalSync", () => ({
  savePendingWeeklyGoal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves selected goal and routes to paywall when user skips notifications", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("onboarding.skip"));
    fireEvent.press(getByText("10"));
    fireEvent.press(getByText("onboarding.goal.lockCta"));
    fireEvent.press(getByText("onboarding.notifications.notNow"));

    await waitFor(() => {
      expect(savePendingWeeklyGoal).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY, "1");
    });
    expect(apiJson).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: { source: "onboarding" },
    });
  });
});
