import { fireEvent, render, screen } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { SettingsScreenView } from "../../../features/profile/components/SettingsScreenView";
import type { SettingsScreenController } from "../../../features/profile/hooks/useSettingsScreenController";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function createController(): SettingsScreenController {
  return {
    t: ((key: string) => key) as unknown as TFunction,
    accountActions: { confirmSignOut: jest.fn(), confirmDeleteAccount: jest.fn() },
    languageName: "Deutsch",
    navigation: {
      goBack: jest.fn(),
      openLanguageSettings: jest.fn(),
      openNotifications: jest.fn(),
      openPrivacy: jest.fn(),
      openTerms: jest.fn(),
      openImprint: jest.fn(),
      openBlockedUsers: jest.fn(),
      openEngagementDebug: jest.fn(),
      openSubscriptionManagement: jest.fn(),
    },
  } as unknown as SettingsScreenController;
}

describe("SettingsScreenView", () => {
  it("offers language, notifications, legal links and the account actions", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    expect(screen.getByText("profile.settingsTitle")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("profile.language, Deutsch"));
    fireEvent.press(screen.getByLabelText("profile.manageNotifications"));
    fireEvent.press(screen.getByLabelText("legal.linksPrivacy"));
    fireEvent.press(screen.getByLabelText("legal.linksTerms"));
    fireEvent.press(screen.getByLabelText("legal.linksImprint"));
    fireEvent.press(screen.getByLabelText("profile.signOut"));
    fireEvent.press(screen.getByLabelText("legal.deleteAccount.button"));

    expect(controller.navigation.openLanguageSettings).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openNotifications).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openPrivacy).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openTerms).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openImprint).toHaveBeenCalledTimes(1);
    expect(controller.accountActions.confirmSignOut).toHaveBeenCalledTimes(1);
    expect(controller.accountActions.confirmDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("lets a subscriber manage or cancel the subscription from inside the app", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    fireEvent.press(screen.getByLabelText("profile.manageSubscription"));

    expect(controller.navigation.openSubscriptionManagement).toHaveBeenCalledTimes(1);
  });

  it("leads to the list of blocked users", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    fireEvent.press(screen.getByLabelText("safety.blocked.title"));

    expect(controller.navigation.openBlockedUsers).toHaveBeenCalledTimes(1);
  });

  it("leads to the engine debug screen in development builds", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    fireEvent.press(screen.getByLabelText("engagementDebug.title"));

    expect(controller.navigation.openEngagementDebug).toHaveBeenCalledTimes(1);
  });

  it("goes back from the top bar", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    fireEvent.press(screen.getByLabelText("common.goBack"));
    expect(controller.navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
