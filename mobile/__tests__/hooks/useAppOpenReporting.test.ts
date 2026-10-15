import { AppState } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAppOpenReporting } from "../../hooks/useAppOpenReporting";
import { apiJson } from "../../lib/client";
import { isNotificationPermissionGranted } from "../../lib/notificationPermission";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/notificationPermission", () => ({
  isNotificationPermissionGranted: jest.fn(),
}));

const mockApiJson = jest.mocked(apiJson);
const mockPermissionGranted = jest.mocked(isNotificationPermissionGranted);
const APP_OPEN_PATH = "/engagement/app-open";
const PERMISSION_PATH = "/engagement/notification-permission";

type AppStateListener = (state: string) => void;
let listener: AppStateListener | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  listener = undefined;
  mockApiJson.mockResolvedValue(undefined);
  mockPermissionGranted.mockResolvedValue(true);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    listener = handler as AppStateListener;
    return { remove: jest.fn() } as never;
  });
});

test("reports an app open when the signed-in app starts", async () => {
  renderHook(() => useAppOpenReporting("token"));

  await waitFor(() =>
    expect(mockApiJson).toHaveBeenCalledWith(APP_OPEN_PATH, { method: "POST", token: "token" }),
  );
});

test("reports again each time the app returns to the foreground", async () => {
  renderHook(() => useAppOpenReporting("token"));
  await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(1));

  act(() => {
    listener?.("background");
    listener?.("active");
  });

  await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(2));
});

test("tells the server when notifications are switched off on the device", async () => {
  mockPermissionGranted.mockResolvedValue(false);

  renderHook(() => useAppOpenReporting("token"));

  await waitFor(() =>
    expect(mockApiJson).toHaveBeenCalledWith(PERMISSION_PATH, {
      method: "POST",
      token: "token",
      body: { granted: false },
    }),
  );
});

test("stays quiet about the permission while notifications are allowed", async () => {
  renderHook(() => useAppOpenReporting("token"));
  await waitFor(() => expect(mockPermissionGranted).toHaveBeenCalled());
  await act(async () => undefined);

  expect(mockApiJson).not.toHaveBeenCalledWith(PERMISSION_PATH, expect.anything());
});

test("stays idle while signed out", async () => {
  renderHook(() => useAppOpenReporting(null));
  await act(async () => undefined);

  expect(mockApiJson).not.toHaveBeenCalled();
});
