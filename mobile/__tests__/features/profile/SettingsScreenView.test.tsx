import { fireEvent, render, screen } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { SettingsScreenView } from "../../../features/profile/components/SettingsScreenView";
import type { SettingsScreenController } from "../../../features/profile/hooks/useSettingsScreenController";

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
    navigation: {
      goBack: jest.fn(),
      openNotifications: jest.fn(),
      openPrivacy: jest.fn(),
      openTerms: jest.fn(),
    },
  } as unknown as SettingsScreenController;
}

describe("SettingsScreenView", () => {
  it("offers notifications, legal links and the account actions", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    expect(screen.getByText("profile.settingsTitle")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("profile.manageNotifications"));
    fireEvent.press(screen.getByLabelText("legal.linksPrivacy"));
    fireEvent.press(screen.getByLabelText("legal.linksTerms"));
    fireEvent.press(screen.getByLabelText("profile.signOut"));
    fireEvent.press(screen.getByLabelText("legal.deleteAccount.button"));

    expect(controller.navigation.openNotifications).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openPrivacy).toHaveBeenCalledTimes(1);
    expect(controller.navigation.openTerms).toHaveBeenCalledTimes(1);
    expect(controller.accountActions.confirmSignOut).toHaveBeenCalledTimes(1);
    expect(controller.accountActions.confirmDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("goes back from the top bar", () => {
    const controller = createController();
    render(<SettingsScreenView controller={controller} />);

    fireEvent.press(screen.getByLabelText("common.goBack"));
    expect(controller.navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
