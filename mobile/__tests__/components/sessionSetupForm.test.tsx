import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.FadeIn = { duration: () => ({}) };
  Reanimated.FadeOut = { duration: () => ({}) };
  return Reanimated;
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", hydrated: true }),
}));

jest.mock("../../lib/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    payload: unknown;
    constructor(status: number, message: string, payload: unknown = null) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  },
  apiJson: jest.fn(),
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

describe("SessionSetupForm tag validation", () => {
  it("shows validation hints for too-long and duplicate tags", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SessionSetupForm initialSessionType="beat_making" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByText("sessionSetup.addOptionalDetails"));

    const tagInput = getByPlaceholderText("sessionSetup.tagPlaceholder");

    fireEvent.changeText(tagInput, "a".repeat(33));
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagTooLong")).toBeTruthy();
    });

    fireEvent.changeText(tagInput, "trap");
    fireEvent.press(getByText("+"));

    fireEvent.changeText(tagInput, "trap");
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagAlreadyAdded")).toBeTruthy();
    });
  });

  it("shows validation hint when tag limit is reached", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SessionSetupForm initialSessionType="beat_making" onStarted={jest.fn()} />,
    );

    fireEvent.press(getByText("sessionSetup.addOptionalDetails"));
    const tagInput = getByPlaceholderText("sessionSetup.tagPlaceholder");

    for (let i = 1; i <= 20; i += 1) {
      fireEvent.changeText(tagInput, `tag${i}`);
      fireEvent.press(getByText("+"));
    }

    fireEvent.changeText(tagInput, "overflow-tag");
    fireEvent.press(getByText("+"));

    await waitFor(() => {
      expect(getByText("sessionSetup.tagLimitReached")).toBeTruthy();
    });
  });
});

