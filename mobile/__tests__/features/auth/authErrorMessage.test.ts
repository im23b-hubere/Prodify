import type { TFunction } from "i18next";

import { loginErrorMessage, registrationErrorMessage } from "../../../features/auth/authErrorMessage";
import { ApiError } from "../../../lib/client";

const t = ((key: string) => key) as TFunction;

describe("auth form error mapping", () => {
  it("maps duplicate email registration to a sign-in hint", () => {
    expect(registrationErrorMessage(new ApiError(409, "ignored", null, "EMAIL_TAKEN"), t)).toBe(
      "errors.auth.emailTaken",
    );
  });

  it("maps a taken username so the user can pick another", () => {
    expect(
      registrationErrorMessage(new ApiError(409, "This username is already taken.", null, "USERNAME_TAKEN"), t),
    ).toBe("errors.auth.usernameTaken");
  });

  it("maps the legacy generic register message to a conflict hint", () => {
    expect(
      registrationErrorMessage(
        new ApiError(400, "Unable to register with the provided credentials"),
        t,
      ),
    ).toBe("errors.auth.registerConflict");
  });

  it("keeps rate-limit copy for 429s", () => {
    expect(registrationErrorMessage(new ApiError(429, "slow down"), t)).toBe("errors.tooManyRequests");
  });

  it("maps invalid login credentials", () => {
    expect(
      loginErrorMessage(new ApiError(401, "Invalid email or password", null, "INVALID_CREDENTIALS"), t),
    ).toBe("errors.auth.invalidCredentials");
  });

  it("falls back to the register copy for unknown errors", () => {
    expect(registrationErrorMessage({}, t)).toBe("auth.register.registerFailed");
  });
});
