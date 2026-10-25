import type { TFunction } from "i18next";

import { ApiError } from "./apiErrors";
import i18n from "./i18n";

const CODE_TO_KEY: Record<string, string> = {
  invalid_credentials: "errors.auth.invalidCredentials",
  email_taken: "errors.auth.emailTaken",
  username_taken: "errors.auth.usernameTaken",
  register_conflict: "errors.auth.registerConflict",
  social_email_required: "errors.auth.socialEmailRequired",
  social_token_invalid: "errors.auth.socialTokenInvalid",
  social_provider_unavailable: "errors.auth.socialProviderUnavailable",
  username_rejected: "errors.auth.usernameRejected",
  account_suspended: "errors.auth.accountSuspended",
  too_many_requests: "errors.tooManyRequests",
  request_timeout: "errors.requestTimeout",
  network_error: "errors.network",
  service_unavailable: "errors.serviceUnavailable",
  rescue_limit_reached: "errors.rescueLimitReached",
  content_rejected: "errors.contentRejected",
};

function looksLikeOpaqueDump(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  if (trimmed.length > 220) return true;
  return false;
}

function resolveUserFacingError(
  caught: unknown,
  t: TFunction,
  fallback: () => string,
): string {
  if (caught instanceof ApiError && caught.code) {
    // The server sends upper-case codes (ACCOUNT_SUSPENDED); the table keys are lower-case.
    const key = CODE_TO_KEY[caught.code.toLowerCase()];
    if (key) return t(key);
  }

  if (caught instanceof Error) {
    const message = caught.message.trim();
    if (!message || looksLikeOpaqueDump(message)) return fallback();

    const lower = message.toLowerCase();
    if (lower.includes("network request failed") || lower.includes("failed to fetch")) {
      return t("errors.network");
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return t("errors.requestTimeout");
    }
    return message;
  }

  return fallback();
}

/**
 * Resolve copy for alerts and inline errors.
 * Prefer coded keys; otherwise keep short English API messages; never show opaque dumps.
 */
export function userFacingErrorMessage(
  caught: unknown,
  t: TFunction,
  fallbackKey: string,
): string {
  return resolveUserFacingError(caught, t, () => t(fallbackKey));
}

/** Same rules when the caller already holds a translated fallback string. */
export function userFacingErrorOrFallback(caught: unknown, fallback: string): string {
  return resolveUserFacingError(caught, i18n.t.bind(i18n) as TFunction, () => fallback);
}
