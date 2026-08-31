import { renderHook, waitFor } from "@testing-library/react-native";

import { useNotificationInbox } from "../../features/notifications/useNotificationInbox";
import {
  loadInbox,
  loadSettings,
  markAllRead,
  markServerInboxRead,
  syncServerInbox,
} from "../../lib/notificationInbox";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseAuth = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../lib/notificationInbox", () => ({
  loadInbox: jest.fn(),
  loadSettings: jest.fn(),
  markAllRead: jest.fn(),
  markServerInboxRead: jest.fn(),
  removeItem: jest.fn(),
  saveSettings: jest.fn(),
  syncServerInbox: jest.fn(),
}));

jest.mock("../../lib/weeklyRecapNotifications", () => ({
  syncWeeklyRecapReminder: jest.fn(),
}));

const mockLoadInbox = loadInbox as jest.MockedFunction<typeof loadInbox>;
const mockLoadSettings = loadSettings as jest.MockedFunction<typeof loadSettings>;
const mockMarkAllRead = markAllRead as jest.MockedFunction<typeof markAllRead>;
const mockMarkServerInboxRead = markServerInboxRead as jest.MockedFunction<
  typeof markServerInboxRead
>;
const mockSyncServerInbox = syncServerInbox as jest.MockedFunction<typeof syncServerInbox>;

const userAInbox = [
  {
    id: "a-1",
    category: "achievement" as const,
    priority: "normal" as const,
    title: "User A",
    body: "Achievement",
    createdAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    read: false,
  },
];

const userBInbox = [
  {
    id: "b-1",
    category: "social" as const,
    priority: "high" as const,
    title: "User B",
    body: "Social",
    createdAt: 1_700_000_100_000,
    expiresAt: 1_800_000_100_000,
    read: false,
  },
];

const defaultSettings = {
  streak: true,
  achievements: true,
  social: true,
  tips: true,
  quietStartHour: 23,
  quietEndHour: 7,
  frequency: "all" as const,
};

function renderNotificationInboxHook(token: string | null, userId: number | null) {
  mockUseAuth.mockReturnValue({
    token,
    user: userId == null ? null : { id: userId },
  });

  return renderHook(
    ({
      token: hookToken,
      userId: hookUserId,
    }: {
      token: string | null;
      userId: number | null;
    }) => {
      mockUseAuth.mockReturnValue({
        token: hookToken,
        user: hookUserId == null ? null : { id: hookUserId },
      });
      return useNotificationInbox();
    },
    { initialProps: { token, userId } },
  );
}

describe("useNotificationInbox auth scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadInbox.mockResolvedValue(userAInbox);
    mockLoadSettings.mockResolvedValue(defaultSettings);
    mockMarkAllRead.mockResolvedValue(undefined);
    mockMarkServerInboxRead.mockResolvedValue(undefined);
    mockSyncServerInbox.mockResolvedValue(0);
  });

  async function waitForUserAInbox(result: { current: ReturnType<typeof useNotificationInbox> }) {
    await waitFor(() => {
      expect(result.current.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "a-1" })]),
      );
    });
  }

  it("clears in-memory inbox on sign-out", async () => {
    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    await waitForUserAInbox(result);

    rerender({ token: null, userId: null });

    expect(result.current.items).toEqual([]);
  });

  it("clears User A inbox before User B loads", async () => {
    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    await waitForUserAInbox(result);

    mockLoadInbox.mockResolvedValue(userBInbox);
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.items).toEqual([]);

    await waitFor(() => {
      expect(result.current.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "b-1" })]),
      );
    });
  });

  it("ignores stale User A load responses after account switch", async () => {
    let staleResolve: ((value: typeof userAInbox) => void) | undefined;
    mockLoadInbox.mockImplementation(
      () =>
        new Promise((resolve) => {
          staleResolve = resolve;
        }),
    );

    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    mockLoadInbox.mockResolvedValue(userBInbox);
    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userAInbox);
    await Promise.resolve();

    expect(result.current.items).toEqual([]);

    await waitFor(() => {
      expect(result.current.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "b-1" })]),
      );
    });
  });

  it("preserves in-memory inbox on same-user token refresh", async () => {
    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    await waitForUserAInbox(result);

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "a-1" })]),
    );
    expect(result.current.initialLoading).toBe(false);
  });

  it("ignores stale server sync responses after account switch", async () => {
    let staleResolve: ((value: number) => void) | undefined;
    mockSyncServerInbox.mockImplementation(
      () =>
        new Promise((resolve) => {
          staleResolve = resolve;
        }),
    );

    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    mockSyncServerInbox.mockResolvedValue(0);
    mockLoadInbox.mockResolvedValue(userBInbox);
    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(3);
    await Promise.resolve();

    await waitFor(() => {
      expect(result.current.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "b-1" })]),
      );
    });
  });

  it("keeps device notification settings available across account switches", async () => {
    const { result, rerender } = renderNotificationInboxHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.settings).toEqual(defaultSettings);
    });

    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.settings).toEqual(defaultSettings);
    });
  });
});
