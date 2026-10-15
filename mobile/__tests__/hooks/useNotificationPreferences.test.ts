import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useNotificationPreferences } from "../../features/notifications/useNotificationPreferences";
import { hasSavedSettings, loadSettings, saveSettings } from "../../lib/notificationInbox";
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "../../lib/notificationPreferences";
import type { NotificationSettings } from "../../lib/notificationTypes";

jest.mock("../../lib/notificationInbox", () => ({
  hasSavedSettings: jest.fn(),
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

jest.mock("../../lib/notificationPreferences", () => ({
  ...jest.requireActual("../../lib/notificationPreferences"),
  fetchNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
}));

const mockHasSavedSettings = jest.mocked(hasSavedSettings);
const mockLoadSettings = jest.mocked(loadSettings);
const mockSaveSettings = jest.mocked(saveSettings);
const mockFetch = jest.mocked(fetchNotificationPreferences);
const mockSave = jest.mocked(saveNotificationPreferences);

const serverDefaults: NotificationPreferences = {
  smart_enabled: true,
  streak: true,
  social: true,
  challenge: true,
  rank: true,
  reengagement: true,
  quiet_start_minute: 22 * 60 + 30,
  quiet_end_minute: 8 * 60,
};

const deviceSettings: NotificationSettings = {
  streak: true,
  achievements: true,
  social: false,
  tips: true,
  quietStartMinute: 0,
  quietEndMinute: 0,
  frequency: "all",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSettings.mockResolvedValue(deviceSettings);
  mockSaveSettings.mockResolvedValue(undefined);
  mockHasSavedSettings.mockResolvedValue(false);
  mockFetch.mockResolvedValue({ ...serverDefaults, customized: true });
  mockSave.mockImplementation(async (_token, prefs) => ({ ...prefs, customized: true }));
});

it("loads the producer's server preferences", async () => {
  const { result } = renderHook(() => useNotificationPreferences("token"));

  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.preferences).toEqual(serverDefaults);
  expect(mockSave).not.toHaveBeenCalled();
});

it("uploads settings saved on this device once, when the account has none yet", async () => {
  mockFetch.mockResolvedValue({ ...serverDefaults, customized: false });
  mockHasSavedSettings.mockResolvedValue(true);

  const { result } = renderHook(() => useNotificationPreferences("token"));

  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(mockSave).toHaveBeenCalledWith("token", expect.objectContaining({ social: false }));
  expect(result.current.preferences?.social).toBe(false);
});

it("keeps the server defaults when the device never had custom settings", async () => {
  mockFetch.mockResolvedValue({ ...serverDefaults, customized: false });

  const { result } = renderHook(() => useNotificationPreferences("token"));

  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(mockSave).not.toHaveBeenCalled();
});

it("mirrors the server preferences into the device inbox filter", async () => {
  renderHook(() => useNotificationPreferences("token"));

  await waitFor(() =>
    expect(mockSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ social: true, quietStartMinute: 22 * 60 + 30 }),
    ),
  );
});

it("reports a load failure so the sheet can offer a retry", async () => {
  mockFetch.mockRejectedValueOnce(new Error("offline"));

  const { result } = renderHook(() => useNotificationPreferences("token"));

  await waitFor(() => expect(result.current.status).toBe("error"));

  await act(() => result.current.retry());

  expect(result.current.status).toBe("ready");
});

it("applies a change at once and keeps it once the server confirms", async () => {
  const { result } = renderHook(() => useNotificationPreferences("token"));
  await waitFor(() => expect(result.current.status).toBe("ready"));

  await act(() => result.current.update({ rank: false }));

  expect(mockSave).toHaveBeenCalledWith("token", { ...serverDefaults, rank: false });
  expect(result.current.preferences?.rank).toBe(false);
  expect(result.current.saveFailed).toBe(false);
});

it("rolls a change back when the server rejects it", async () => {
  const { result } = renderHook(() => useNotificationPreferences("token"));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  mockSave.mockRejectedValueOnce(new Error("offline"));

  await act(() => result.current.update({ social: false }));

  expect(result.current.preferences?.social).toBe(true);
  expect(result.current.saveFailed).toBe(true);
});

it("stays idle while signed out", () => {
  const { result } = renderHook(() => useNotificationPreferences(null));

  expect(result.current.status).toBe("idle");
  expect(mockFetch).not.toHaveBeenCalled();
});
