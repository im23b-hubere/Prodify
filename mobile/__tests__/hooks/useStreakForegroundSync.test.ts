import { AppState } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useStreakForegroundSync } from "../../hooks/useStreakForegroundSync";
import { apiJson } from "../../lib/client";
import { readDeviceTimezone } from "../../lib/deviceTimezone";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));
// Only the device lookup is faked; the real reporter runs so the request order is observable.
jest.mock("../../lib/deviceTimezone", () => ({
  ...jest.requireActual("../../lib/deviceTimezone"),
  readDeviceTimezone: jest.fn(),
}));

const mockApiJson = jest.mocked(apiJson);
const mockReadDeviceTimezone = jest.mocked(readDeviceTimezone);

const TIMEZONE_PATH = "/users/me/timezone";
const RECONCILE_PATH = "/streak/reconcile";

type AppStateListener = (state: string) => void;

let listener: AppStateListener | undefined;

function requestedPaths() {
  return mockApiJson.mock.calls.map(([path]) => path);
}

function returnToForeground() {
  act(() => {
    listener?.("background");
    listener?.("active");
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  listener = undefined;
  mockApiJson.mockResolvedValue(undefined);
  mockReadDeviceTimezone.mockReturnValue("Europe/Berlin");
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    listener = handler as AppStateListener;
    return { remove: jest.fn() } as never;
  });
});

test("reports the device timezone before reconciling the streak", async () => {
  renderHook(() => useStreakForegroundSync("token"));

  await waitFor(() => expect(requestedPaths()).toEqual([TIMEZONE_PATH, RECONCILE_PATH]));
  expect(mockApiJson).toHaveBeenCalledWith(TIMEZONE_PATH, {
    method: "PUT",
    token: "token",
    body: { timezone: "Europe/Berlin" },
  });
});

test("skips a repeat timezone report but still reconciles on every foreground", async () => {
  renderHook(() => useStreakForegroundSync("token"));
  await waitFor(() => expect(requestedPaths()).toHaveLength(2));

  returnToForeground();

  await waitFor(() =>
    expect(requestedPaths()).toEqual([TIMEZONE_PATH, RECONCILE_PATH, RECONCILE_PATH]),
  );
});

test("reports again after the user crosses into another timezone", async () => {
  renderHook(() => useStreakForegroundSync("token"));
  await waitFor(() => expect(requestedPaths()).toHaveLength(2));

  mockReadDeviceTimezone.mockReturnValue("Asia/Tokyo");
  returnToForeground();

  await waitFor(() =>
    expect(requestedPaths()).toEqual([
      TIMEZONE_PATH,
      RECONCILE_PATH,
      TIMEZONE_PATH,
      RECONCILE_PATH,
    ]),
  );
});

test("still reconciles when the timezone report fails", async () => {
  mockApiJson.mockImplementation((path) =>
    path === TIMEZONE_PATH ? Promise.reject(new Error("offline")) : Promise.resolve(undefined),
  );

  renderHook(() => useStreakForegroundSync("token"));

  await waitFor(() => expect(requestedPaths()).toEqual([TIMEZONE_PATH, RECONCILE_PATH]));
});

test("stays idle while signed out", async () => {
  renderHook(() => useStreakForegroundSync(null));
  await act(async () => undefined);

  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(mockApiJson).not.toHaveBeenCalled();
});
