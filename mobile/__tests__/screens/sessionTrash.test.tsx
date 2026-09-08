import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import SessionTrashScreen from "../../app/(tabs)/session-trash";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockApiJson = jest.fn();
let mockToken: string | null = "token-123";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
  useFocusEffect: () => undefined,
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
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && Object.keys(options).length > 0) return key;
      return key;
    },
  }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: mockToken }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("../../lib/sessionDto", () => ({
  parseSessionList: (raw: unknown) => raw as unknown[],
}));

jest.mock("../../components/ui/ScreenHeader", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    ScreenHeader: ({ title, actionNode }: { title: string; actionNode?: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {actionNode}
      </View>
    ),
  };
});

describe("SessionTrashScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = "token-123";
    mockCanGoBack.mockReturnValue(true);
    mockApiJson.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/sessions/trash?limit=50&offset=0") {
        return Promise.resolve([
          {
            id: 99,
            user_id: 1,
            started_at: "2026-04-20T12:00:00Z",
            stopped_at: "2026-04-20T13:00:00Z",
            duration_seconds: 3600,
            session_type: "beat_making",
          },
        ]);
      }
      if (path === "/sessions/item/99/restore" && opts?.method === "POST") {
        return Promise.resolve({});
      }
      return Promise.resolve([]);
    });
  });

  it("shows a clear error when user is not signed in", async () => {
    mockToken = null;
    const { findByText } = render(<SessionTrashScreen />);
    expect(await findByText("sessionTrash.notSignedIn")).toBeTruthy();
  });

  it("keeps item visible when restore request fails", async () => {
    mockApiJson.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/sessions/trash?limit=50&offset=0") {
        return Promise.resolve([
          {
            id: 99,
            user_id: 1,
            started_at: "2026-04-20T12:00:00Z",
            stopped_at: "2026-04-20T13:00:00Z",
            duration_seconds: 3600,
            session_type: "beat_making",
          },
        ]);
      }
      if (path === "/sessions/item/99/restore" && opts?.method === "POST") {
        return Promise.reject(new Error("restore failed"));
      }
      return Promise.resolve([]);
    });

    const { findByText, getByText } = render(<SessionTrashScreen />);

    await findByText("sessionTrash.restore");
    fireEvent.press(getByText("sessionTrash.restore"));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith("/sessions/item/99/restore", {
        token: "token-123",
        method: "POST",
      }),
    );
    expect(getByText("sessionTrash.restore")).toBeTruthy();
  });

  it("loads more deleted sessions when load more is pressed", async () => {
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/trash?limit=50&offset=0") {
        return Promise.resolve(
          Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            user_id: 1,
            started_at: "2026-04-20T12:00:00Z",
            stopped_at: "2026-04-20T13:00:00Z",
            duration_seconds: 3600,
            session_type: "beat_making",
          })),
        );
      }
      if (path === "/sessions/trash?limit=50&offset=50") {
        return Promise.resolve([
          {
            id: 200,
            user_id: 1,
            started_at: "2026-04-21T12:00:00Z",
            stopped_at: "2026-04-21T13:00:00Z",
            duration_seconds: 3600,
            session_type: "writing",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const { findByText, getByText } = render(<SessionTrashScreen />);
    await findByText("sessionTrash.loadMore");
    fireEvent.press(getByText("sessionTrash.loadMore"));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith("/sessions/trash?limit=50&offset=50", {
        token: "token-123",
      }),
    );
  });

  it("goes back from the header arrow when history exists", async () => {
    mockCanGoBack.mockReturnValue(true);
    const { findByLabelText } = render(<SessionTrashScreen />);
    fireEvent.press(await findByLabelText("sessionTrash.backA11y"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces to dashboard from the header arrow when there is no history", async () => {
    mockCanGoBack.mockReturnValue(false);
    const { findByLabelText } = render(<SessionTrashScreen />);
    fireEvent.press(await findByLabelText("sessionTrash.backA11y"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
