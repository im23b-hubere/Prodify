import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import FriendProfileScreen from "../../app/profile/[id]";

const mockBack = jest.fn();
const mockApiJson = jest.fn();

const translate = (key: string) => key;

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-123", user: { id: 5, username: "me" } }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "9" }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/social", () => ({
  fetchBuddyStatus: jest.fn().mockResolvedValue(null),
  fetchWeeklyRecap: jest.fn().mockResolvedValue(null),
}));

describe("FriendProfileScreen loading UX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation(() => new Promise(() => undefined));
  });

  it("shows loading state with back navigation while profile loads", async () => {
    const { getByText } = render(<FriendProfileScreen />);

    expect(getByText("friendProfile.backArrow")).toBeTruthy();
    await waitFor(() => {
      expect(getByText("friendProfile.loadingProfile")).toBeTruthy();
    });
  });
});
