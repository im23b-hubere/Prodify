import type { TFunction } from "i18next";

import { ApiError } from "../../lib/client";

export function registrationErrorMessage(caught: unknown, t: TFunction): string {
  return mapAuthFormError(caught, t, "auth.register.registerFailed");
}

export function loginErrorMessage(caught: unknown, t: TFunction): string {
  return mapAuthFormError(caught, t, "auth.login.signInFailed");
}

function mapAuthFormError(caught: unknown, t: TFunction, fallbackKey: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 429) return t("errors.tooManyRequests");
    const mapped = mapKnownAuthError(caught.code, caught.message, t);
    if (mapped) return mapped;
  }
  return caught instanceof Error && caught.message.trim() ? caught.message : t(fallbackKey);
}

function mapKnownAuthError(code: string | null, message: string, t: TFunction): string | null {
  if (code === "EMAIL_TAKEN") return t("errors.auth.emailTaken");
  if (code === "USERNAME_TAKEN") return t("errors.auth.usernameTaken");
  if (code === "REGISTRATION_CONFLICT") return t("errors.auth.registerConflict");
  if (code === "INVALID_CREDENTIALS") return t("errors.auth.invalidCredentials");

  if (/username is already taken/i.test(message)) return t("errors.auth.usernameTaken");
  if (/already registered/i.test(message)) return t("errors.auth.emailTaken");
  if (
    /unable to register with the provided credentials/i.test(message) ||
    /email or username is already in use/i.test(message)
  ) {
    return t("errors.auth.registerConflict");
  }
  if (/invalid email or password/i.test(message)) return t("errors.auth.invalidCredentials");
  return null;
}
