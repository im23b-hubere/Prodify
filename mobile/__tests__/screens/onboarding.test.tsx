import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import OnboardingScreen from "../../app/onboarding/index";
import { ONBOARDING_COMPLETE_KEY } from "../../constants/storageKeys";
import { apiJson } from "../../lib/client";
import { saveOnboardingQuiz } from "../../lib/onboardingQuiz";
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
  const chain = { duration: () => chain, springify: () => chain, delay: () => chain };
  Reanimated.FadeInDown = chain;
  Reanimated.FadeInUp = chain;
  return Reanimated;
});

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
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "onboarding.quiz.weeklyGoal.session") return "session";
      if (key === "onboarding.quiz.weeklyGoal.sessions") return "sessions";
      if (opts && "count" in opts) return `${key}:${opts.count}`;
      if (opts && "goal" in opts) return `${key}:${opts.goal}`;
      return key;
    },
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: null }),
}));

jest.mock("../../components/brand/ProdifyWordmark", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    ProdifyWordmark: () => <Text>Prodify</Text>,
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

jest.mock("../../lib/onboardingGoalSync", () => ({
  savePendingWeeklyGoal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/onboardingQuiz", () => ({
  ...jest.requireActual("../../lib/onboardingQuiz"),
  saveOnboardingQuiz: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips quiz to weekly goal and routes to personalized paywall", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("onboarding.skip"));
    fireEvent.press(getByText("10"));
    fireEvent.press(getByText("onboarding.quiz.weeklyGoal.cta"));
    fireEvent.press(getByText("onboarding.quiz.plan.cta"));
    fireEvent.press(getByText("onboarding.notifications.notNow"));

    await waitFor(() => {
      expect(savePendingWeeklyGoal).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(saveOnboardingQuiz).toHaveBeenCalledWith(expect.objectContaining({ weeklyGoal: 10 }));
    });
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY, "1");
    });
    expect(apiJson).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: { source: "onboarding", variant: "outcome" },
    });
  });
});
