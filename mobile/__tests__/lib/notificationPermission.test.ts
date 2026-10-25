import {
  isNotificationPermissionGranted,
  readNotificationPermission,
  requestNotificationPermission,
} from "../../lib/notificationPermission";

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
}));

jest.mock("../../lib/e2eMode", () => ({ isE2eModeEnabled: () => false }));

jest.mock("../../lib/streakNotifications", () => ({
  ensureStreakNotificationChannel: jest.fn().mockResolvedValue(undefined),
}));

describe("notificationPermission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("counts only an explicit grant as allowed, not a question never asked", async () => {
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    await expect(isNotificationPermissionGranted()).resolves.toBe(false);

    mockGetPermissions.mockResolvedValue({ status: "granted" });
    await expect(isNotificationPermissionGranted()).resolves.toBe(true);
  });

  it("asks the system while the user has not decided yet", async () => {
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockRequestPermissions.mockResolvedValue({ status: "granted" });

    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  it("never asks again after the user declined", async () => {
    mockGetPermissions.mockResolvedValue({ status: "denied" });

    await expect(requestNotificationPermission()).resolves.toBe("denied");
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it("reports an unknown status when the system cannot answer", async () => {
    mockGetPermissions.mockRejectedValue(new Error("unavailable"));

    await expect(readNotificationPermission()).resolves.toBeNull();
  });
});
