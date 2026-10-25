import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import OnboardingScreen from "../../app/onboarding/index";
import { ONBOARDING_COMPLETE_KEY } from "../../constants/storageKeys";
import { apiJson } from "../../lib/client";
import { saveOnboardingQuiz } from "../../lib/onboardingQuiz";
import { savePendingWeeklyGoal } from "../../lib/onboardingGoalSync";
import { resolvePremiumAccess } from "../../lib/premiumAccess";

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-gesture-handler", () => require("../../test/gestureHandlerStub"));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  const chain = {
    duration: () => chain,
    springify: () => chain,
    delay: () => chain,
    easing: () => chain,
  };
  Reanimated.FadeIn = chain;
  Reanimated.FadeInDown = chain;
  Reanimated.FadeInUp = chain;
  Reanimated.useAnimatedReaction = () => undefined;
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
  useAuth: () => mockUseAuth(),
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

jest.mock("../../lib/premiumAccess", () => ({
  resolvePremiumAccess: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUseAuth.mockReturnValue({ token: null, user: null });
  (resolvePremiumAccess as jest.Mock).mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

type GetByText = ReturnType<typeof render>["getByText"];

/** Through the three intro pages to the first question. */
function passIntro(getByText: GetByText) {
  fireEvent.press(getByText("onboarding.next"));
  fireEvent.press(getByText("onboarding.next"));
  fireEvent.press(getByText("onboarding.continue"));
}

/** Answers every question (the timeline starts on "<1 year") and lets the set-up finish. */
function answerQuiz(getByText: GetByText, options?: { weeklyGoal?: string }) {
  fireEvent.press(getByText("onboarding.continue"));
  fireEvent.press(getByText("onboarding.quiz.genre.options.hip_hop"));
  fireEvent.press(getByText("onboarding.continue"));
  fireEvent.press(getByText("onboarding.quiz.producerGoal.options.finish_tracks"));
  fireEvent.press(getByText("onboarding.continue"));
  if (options?.weeklyGoal) fireEvent.press(getByText(options.weeklyGoal));
  fireEvent.press(getByText("onboarding.quiz.weeklyGoal.cta"));
  // Let the studio set-up animation finish so the workflow moves on.
  act(() => jest.advanceTimersByTime(6000));
}

function skipIntroAndCompleteQuiz(getByText: GetByText, options?: { weeklyGoal?: string }) {
  passIntro(getByText);
  answerQuiz(getByText, options);
}

describe("Onboarding navigation and quiz", () => {
  it("requires quiz answers before sending anonymous users to account creation", async () => {
    const { getByText } = render(<OnboardingScreen />);

    passIntro(getByText);
    expect(getByText("onboarding.quiz.experience.title")).toBeTruthy();
    answerQuiz(getByText, { weeklyGoal: "10" });

    await waitFor(() => {
      expect(savePendingWeeklyGoal).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(saveOnboardingQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          experience: "under_1y",
          genre: "hip_hop",
          producerGoal: "finish_tracks",
          weeklyGoal: 10,
        }),
      );
    });
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY, "1");
    });
    expect(apiJson).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/(auth)/register",
      params: { next: "paywall", source: "onboarding", variant: "outcome" },
    });
  });

  it("routes existing users to login and the subscription check without replaying onboarding", () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("onboarding.existingAccount"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/(auth)/login",
      params: { next: "paywall", source: "existing_account", variant: "value" },
    });
  });

  it("moves through intro and every personalization step", () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("onboarding.next"));
    expect(getByText("onboarding.slide2.title")).toBeTruthy();
    fireEvent.press(getByText("onboarding.next"));
    fireEvent.press(getByText("onboarding.continue"));
    expect(getByText("onboarding.quiz.experience.title")).toBeTruthy();

    fireEvent.press(getByText("onboarding.continue"));
    expect(getByText("onboarding.quiz.genre.title")).toBeTruthy();

    fireEvent.press(getByText("onboarding.quiz.genre.options.hip_hop"));
    fireEvent.press(getByText("onboarding.continue"));
    expect(getByText("onboarding.quiz.producerGoal.title")).toBeTruthy();

    fireEvent.press(getByText("onboarding.quiz.producerGoal.options.finish_tracks"));
    fireEvent.press(getByText("onboarding.continue"));
    expect(getByText("onboarding.quiz.weeklyGoal.title")).toBeTruthy();

    fireEvent.press(getByText("14"));
    fireEvent.press(getByText("onboarding.quiz.weeklyGoal.cta"));
    expect(getByText("onboarding.quiz.building.steps.genre")).toBeTruthy();
  });
});

describe("Onboarding completion routing", () => {
  it("sends an existing premium user to the dashboard after onboarding", async () => {
    mockUseAuth.mockReturnValue({
      token: "access-token",
      user: { id: 42, is_premium: false },
    });
    (resolvePremiumAccess as jest.Mock).mockResolvedValue(true);
    (apiJson as jest.Mock).mockResolvedValue(undefined);

    const { getByText } = render(<OnboardingScreen />);
    skipIntroAndCompleteQuiz(getByText);

    await waitFor(() => {
      expect(resolvePremiumAccess).toHaveBeenCalledWith("access-token", "42");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
  });

  it("finishes onboarding for a signed-in unsubscribed user when goal sync is temporarily unavailable", async () => {
    mockUseAuth.mockReturnValue({
      token: "access-token",
      user: { id: 42, is_premium: false },
    });
    (resolvePremiumAccess as jest.Mock).mockResolvedValue(false);
    (apiJson as jest.Mock).mockRejectedValue(new Error("offline"));

    const { getByText } = render(<OnboardingScreen />);
    skipIntroAndCompleteQuiz(getByText);

    await waitFor(() => {
      expect(savePendingWeeklyGoal).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY, "1");
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/paywall",
        params: { source: "onboarding", variant: "outcome" },
      });
    });
  });
});
