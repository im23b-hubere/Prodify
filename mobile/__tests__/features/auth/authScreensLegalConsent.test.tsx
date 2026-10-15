import { render, screen } from "@testing-library/react-native";

import RegisterScreen from "../../../app/(auth)/register";
import LoginScreen from "../../../app/(auth)/login";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../components/brand/ProdifyWordmark", () => ({ ProdifyWordmark: () => null }));
jest.mock("../../../features/auth/components/SocialSignInButtons", () => ({
  SocialSignInButtons: () => null,
}));
jest.mock("../../../features/auth/components/LegalConsentNotice", () => {
  const { Text } = require("react-native");
  return { LegalConsentNotice: () => <Text>legal-consent-notice</Text> };
});
jest.mock("../../../features/auth/hooks/useSocialSignIn", () => ({
  useSocialSignIn: () => ({ pendingProvider: null }),
}));

const mockForm = {
  email: "",
  username: "",
  password: "",
  setEmail: jest.fn(),
  setUsername: jest.fn(),
  setPassword: jest.fn(),
  submit: jest.fn(),
  loading: false,
  error: null,
  showConnectionHint: false,
  openLogin: jest.fn(),
  openRegistration: jest.fn(),
  finishSignIn: jest.fn(),
  finishSignUp: jest.fn(),
};

jest.mock("../../../features/auth/hooks/useRegisterForm", () => ({
  useRegisterForm: () => mockForm,
}));
jest.mock("../../../features/auth/hooks/useLoginForm", () => ({
  useLoginForm: () => mockForm,
}));

describe("legal consent on auth screens", () => {
  it("shows the terms notice when creating an account", () => {
    render(<RegisterScreen />);

    expect(screen.getByText("legal-consent-notice")).toBeTruthy();
  });

  it("shows the terms notice when signing in, since Apple and Google can create accounts there", () => {
    render(<LoginScreen />);

    expect(screen.getByText("legal-consent-notice")).toBeTruthy();
  });
});
