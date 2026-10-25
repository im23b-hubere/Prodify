import { fireEvent, render, screen } from "@testing-library/react-native";

import { LegalConsentNotice } from "../../../features/auth/components/LegalConsentNotice";

const mockOpenLegalPage = jest.fn();

jest.mock("../../../constants/legal", () => ({
  openLegalPage: (page: string) => mockOpenLegalPage(page),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("LegalConsentNotice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tells the user that continuing means accepting the terms", () => {
    render(<LegalConsentNotice />);

    expect(screen.getByText("auth.legalConsent.notice")).toBeTruthy();
  });

  it("opens the terms of use", () => {
    render(<LegalConsentNotice />);

    fireEvent.press(screen.getByRole("link", { name: "auth.legalConsent.terms" }));

    expect(mockOpenLegalPage).toHaveBeenCalledWith("terms");
  });

  it("opens the privacy policy", () => {
    render(<LegalConsentNotice />);

    fireEvent.press(screen.getByRole("link", { name: "auth.legalConsent.privacy" }));

    expect(mockOpenLegalPage).toHaveBeenCalledWith("privacy");
  });
});
