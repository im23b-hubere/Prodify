import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { NotificationPermissionBanner } from "../../../features/notifications/NotificationPermissionBanner";
import {
  readNotificationPermission,
  requestNotificationPermission,
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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockRead = jest.mocked(readNotificationPermission);
const mockRequest = jest.mocked(requestNotificationPermission);

describe("NotificationPermissionBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lets someone who was never asked turn notifications on", async () => {
    mockRead.mockResolvedValue("undetermined");
    mockRequest.mockResolvedValue("granted");
    render(<NotificationPermissionBanner />);

    const enable = await screen.findByLabelText("notificationsUi.permission.enable");
    await act(async () => {
      fireEvent.press(enable);
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(registerPushTokenWithBackend).toHaveBeenCalledWith("token");
    await waitFor(() =>
      expect(screen.queryByLabelText("notificationsUi.permission.enable")).toBeNull(),
    );
  });

  it("sends someone who declined to the system settings instead of asking again", async () => {
    mockRead.mockResolvedValue("denied");
    render(<NotificationPermissionBanner />);

    fireEvent.press(await screen.findByLabelText("notificationsUi.permission.openSettings"));

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("shows nothing while notifications are allowed", async () => {
    mockRead.mockResolvedValue("granted");
    render(<NotificationPermissionBanner />);

    await waitFor(() => expect(mockRead).toHaveBeenCalled());
    await act(async () => undefined);

    expect(screen.toJSON()).toBeNull();
  });
});
