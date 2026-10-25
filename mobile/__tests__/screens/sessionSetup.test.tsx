import { fireEvent, render, screen } from "@testing-library/react-native";

import SessionSetupScreen from "../../app/session/setup";

const mockReplace = jest.fn();
const mockParams: { source?: string } = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
    dismissTo: jest.fn(),
    canDismiss: () => true,
    dismiss: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../components/session/SessionSetupForm", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    SessionSetupForm: ({
      onStarted,
      onActiveSessionConflict,
    }: {
      onStarted: (session: { id: number }) => void;
      onActiveSessionConflict?: (sessionId?: number) => void;
    }) => (
      <>
        {React.createElement(Pressable, {
          testID: "session-started",
          onPress: () => onStarted({ id: 5 }),
        })}
        {React.createElement(Pressable, {
          testID: "session-conflict",
          onPress: () => onActiveSessionConflict?.(8),
        })}
      </>
    ),
  };
});

describe("SessionSetupScreen", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    delete mockParams.source;
  });

  it("replaces itself with the running session after a start", () => {
    mockParams.source = "friends";
    render(<SessionSetupScreen />);

    fireEvent.press(screen.getByTestId("session-started"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/session-active",
      params: { id: "5", source: "friends" },
    });
  });

  it("replaces itself with the session a 409 already named", () => {
    mockParams.source = "stats";
    render(<SessionSetupScreen />);

    fireEvent.press(screen.getByTestId("session-conflict"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/session-active",
      params: { id: "8", source: "stats" },
    });
  });
});
