import type { TFunction } from "i18next";

import {
  loginErrorMessage,
  passwordResetErrorMessage,
  registrationErrorMessage,
  socialSignInErrorMessage,
} from "../../../features/auth/authErrorMessage";
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

  it("asks for another username when the filter rejects it", () => {
    expect(registrationErrorMessage(new ApiError(422, "ignored", null, "USERNAME_REJECTED"), t)).toBe(
      "errors.auth.usernameRejected",
    );
  });

  it("explains a wrong or expired reset code", () => {
    expect(
      passwordResetErrorMessage(new ApiError(400, "ignored", null, "RESET_CODE_INVALID"), t),
    ).toBe("errors.auth.resetCodeInvalid");
  });

  it("explains a suspension on password and social sign-in", () => {
    const suspended = new ApiError(403, "ignored", null, "ACCOUNT_SUSPENDED");
    expect(loginErrorMessage(suspended, t)).toBe("errors.auth.accountSuspended");
    expect(socialSignInErrorMessage(suspended, t)).toBe("errors.auth.accountSuspended");
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

  it("asks for email sharing when Apple hid the address on a new account", () => {
    expect(
      socialSignInErrorMessage(new ApiError(400, "ignored", null, "SOCIAL_EMAIL_REQUIRED"), t),
    ).toBe("errors.auth.socialEmailRequired");
  });

  it("maps a rejected provider token to a retry hint", () => {
    expect(
      socialSignInErrorMessage(new ApiError(401, "ignored", null, "SOCIAL_TOKEN_INVALID"), t),
    ).toBe("errors.auth.socialTokenInvalid");
  });

  it("falls back to the social copy for unknown errors", () => {
    expect(socialSignInErrorMessage({}, t)).toBe("auth.social.failed");
  });
});
