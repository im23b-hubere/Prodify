import { fireEvent, render, screen } from "@testing-library/react-native";

import SessionSetupScreen from "../../app/session/setup";

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
const mockParams: { source?: string } = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
    dismissTo: jest.fn(),
    canDismiss: () => true,
    dismiss: mockDismiss,
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
    mockDismiss.mockClear();
    delete mockParams.source;
  });

  it("closes after a start instead of opening the running session", () => {
    mockParams.source = "friends";
    render(<SessionSetupScreen />);

    fireEvent.press(screen.getByTestId("session-started"));

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("closes when a 409 names a session that is already running", () => {
    mockParams.source = "stats";
    render(<SessionSetupScreen />);

    fireEvent.press(screen.getByTestId("session-conflict"));

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
