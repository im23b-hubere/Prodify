import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useReminderPrompt } from "../../../features/notifications/useReminderPrompt";
import {
  readNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionStatus,
} from "../../../lib/notificationPermission";
import { registerPushTokenWithBackend } from "../../../lib/pushToken";

jest.mock("../../../lib/notificationPermission", () => ({
  readNotificationPermission: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

jest.mock("../../../lib/pushToken", () => ({
  registerPushTokenWithBackend: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token" }),
}));

const mockRead = jest.mocked(readNotificationPermission);
const mockRequest = jest.mocked(requestNotificationPermission);

function givenPermission(status: NotificationPermissionStatus) {
  mockRead.mockResolvedValue(status);
}

async function renderSettled() {
  const hook = renderHook(() => useReminderPrompt());
  await waitFor(() => expect(hook.result.current.settled).toBe(true));
  return hook;
}

describe("useReminderPrompt", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("offers reminders while the user has neither decided nor answered the card", async () => {
    givenPermission("undetermined");

    const { result } = await renderSettled();

    expect(result.current.visible).toBe(true);
  });

  it("stays hidden once notifications are allowed or declined", async () => {
    givenPermission("granted");
    expect((await renderSettled()).result.current.visible).toBe(false);

    givenPermission("denied");
    expect((await renderSettled()).result.current.visible).toBe(false);
  });

  it("asks the system and registers for pushes when reminders are turned on", async () => {
    givenPermission("undetermined");
    mockRequest.mockResolvedValue("granted");
    const { result } = await renderSettled();

    await act(async () => {
      await result.current.accept();
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(registerPushTokenWithBackend).toHaveBeenCalledWith("token");
    expect(result.current.visible).toBe(false);
  });

  it("does not register for pushes when the system prompt is declined", async () => {
    givenPermission("undetermined");
    mockRequest.mockResolvedValue("denied");
    const { result } = await renderSettled();

    await act(async () => {
      await result.current.accept();
    });

    expect(registerPushTokenWithBackend).not.toHaveBeenCalled();
  });

  it("does not offer the card again after Not now", async () => {
    givenPermission("undetermined");
    const first = await renderSettled();

    await act(async () => {
      await first.result.current.dismiss();
    });
    expect(first.result.current.visible).toBe(false);

    const later = await renderSettled();
    expect(later.result.current.visible).toBe(false);
  });
});
