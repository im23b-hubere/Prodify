import i18n from "./i18n";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail) || detail.length === 0) {
    return typeof detail === "object" && detail !== null ? JSON.stringify(detail) : String(detail);
  }

  return detail
    .map((item) => {
      if (typeof item !== "object" || item === null || !("msg" in item)) {
        return JSON.stringify(item);
      }
      const message = String((item as { msg: unknown }).msg);
      const location = (item as { loc?: unknown }).loc;
      const field =
        Array.isArray(location) && location.length > 0
          ? String(location[location.length - 1])
          : null;
      return humanizeValidationMessage(message, field);
    })
    .join("\n");
}

function humanizeValidationMessage(message: string, field: string | null): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("not a valid email") ||
    normalized.includes("value is not a valid email")
  ) {
    return i18n.t("errors.validation.email");
  }
  if (normalized.includes("at least") && normalized.includes("character") && field === "password") {
    return i18n.t("errors.validation.passwordShort");
  }
  if (normalized.includes("at least") && normalized.includes("character") && field === "username") {
    return i18n.t("errors.validation.usernameShort");
  }
  return message;
}
