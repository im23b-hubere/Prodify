import { render, waitFor } from "@testing-library/react-native";

import SessionStackLayout from "../../app/session/_layout";

let mockToken: string | null = "token";
let mockHasAccess = false;

const mockRedirect = jest.fn((_props: unknown) => null);

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockStack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "session-stack" }, children);
  MockStack.Screen = function MockStackScreen() {
    return null;
  };
  return {
    Redirect: function MockRedirect(props: unknown) {
      return mockRedirect(props);
    },
    Stack: MockStack,
  };
});

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: mockToken, user: { id: 1, is_premium: false }, hydrated: true }),
}));

jest.mock("../../features/navigation/usePremiumAccess", () => ({
  usePremiumAccess: () => ({ hasAccess: mockHasAccess, waitingForAccess: false }),
}));

jest.mock("../../components/brand/ProdifyWordmark", () => ({
  ProdifyWordmark: () => null,
}));

describe("session stack access", () => {
  beforeEach(() => {
    mockToken = "token";
    mockHasAccess = false;
    jest.clearAllMocks();
  });

  it("sends a signed-in user without a subscription to the paywall", async () => {
    render(<SessionStackLayout />);

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        href: { pathname: "/paywall", params: { source: "post_auth" } },
      }),
    );
  });

  it("sends a signed-out user to login", async () => {
    mockToken = null;

    render(<SessionStackLayout />);

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/(auth)/login" }),
    );
  });

  it("renders the session screens for a subscriber", async () => {
    mockHasAccess = true;

    const screen = render(<SessionStackLayout />);

    await waitFor(() => expect(screen.getByTestId("session-stack")).toBeTruthy());
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
