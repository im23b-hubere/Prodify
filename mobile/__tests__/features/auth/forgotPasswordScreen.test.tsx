import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ForgotPasswordScreen from "../../../app/(auth)/forgot-password";
import { requestPasswordResetCode } from "../../../features/auth/passwordResetApi";

const mockResetPassword = jest.fn();
const mockBack = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../components/brand/ProdifyWordmark", () => ({ ProdifyWordmark: () => null }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ email: "typed@example.com" }),
  useRouter: () => ({ replace: jest.fn(), back: mockBack }),
}));
jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}));
jest.mock("../../../features/auth/passwordResetApi", () => ({
  requestPasswordResetCode: jest.fn().mockResolvedValue(undefined),
}));

describe("forgot password screen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks for the email first, prefilled from the sign-in screen", () => {
    render(<ForgotPasswordScreen />);

    expect(screen.getByTestId("reset-email-input").props.value).toBe("typed@example.com");
    expect(screen.queryByTestId("reset-code-input")).toBeNull();
  });

  it("shows the code and new password fields once the code is requested", async () => {
    render(<ForgotPasswordScreen />);

    fireEvent.press(screen.getByTestId("reset-send-code-button"));

    await waitFor(() => expect(screen.getByTestId("reset-code-input")).toBeTruthy());
    expect(requestPasswordResetCode).toHaveBeenCalledWith("typed@example.com");
    expect(screen.getByTestId("reset-password-input")).toBeTruthy();
    expect(screen.getByText("auth.reset.codeSent")).toBeTruthy();
  });

  it("returns to the sign-in screen", () => {
    render(<ForgotPasswordScreen />);

    fireEvent.press(screen.getByText("auth.reset.backToLogin"));

    expect(mockBack).toHaveBeenCalled();
  });
});
