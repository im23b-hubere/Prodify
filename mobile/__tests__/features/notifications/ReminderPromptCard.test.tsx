import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ReminderPromptCard } from "../../../features/notifications/ReminderPromptCard";
import {
  readNotificationPermission,
  requestNotificationPermission,
} from "../../../lib/notificationPermission";

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

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

describe("ReminderPromptCard", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("explains the value and asks the system once reminders are turned on", async () => {
    jest.mocked(readNotificationPermission).mockResolvedValue("undetermined");
    jest.mocked(requestNotificationPermission).mockResolvedValue("granted");
    render(<ReminderPromptCard />);

    expect(await screen.findByText("notificationsUi.permission.promptTitle")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("notificationsUi.permission.promptAccept"));
    });

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText("notificationsUi.permission.promptTitle")).toBeNull(),
    );
  });

  it("goes away on Not now without asking the system", async () => {
    jest.mocked(readNotificationPermission).mockResolvedValue("undetermined");
    render(<ReminderPromptCard />);

    const notNow = await screen.findByLabelText("notificationsUi.permission.promptDismiss");
    await act(async () => {
      fireEvent.press(notNow);
    });

    expect(requestNotificationPermission).not.toHaveBeenCalled();
    expect(screen.queryByText("notificationsUi.permission.promptTitle")).toBeNull();
  });
});
