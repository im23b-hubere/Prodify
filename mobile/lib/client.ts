import { API_BASE_URL } from "../constants/api";

const DEFAULT_TIMEOUT_MS = 10_000;

/** Set from AuthProvider: clear stored token when an authenticated request returns 401. */
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setApiUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

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

export type ApiOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
};

/** FastAPI/Pydantic validation errors use `detail` as an array of `{ loc, msg, ... }`. */
function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail) || detail.length === 0) {
    return typeof detail === "object" && detail !== null ? JSON.stringify(detail) : String(detail);
  }

  const lines: string[] = [];
  for (const item of detail) {
    if (typeof item !== "object" || item === null || !("msg" in item)) {
      lines.push(JSON.stringify(item));
      continue;
    }
    const msg = String((item as { msg: unknown }).msg);
    const loc = (item as { loc?: unknown }).loc;
    const field =
      Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : null;

    lines.push(humanizeValidationMessage(msg, field));
  }
  return lines.join("\n");
}

function humanizeValidationMessage(msg: string, field: string | null): string {
  const lower = msg.toLowerCase();
  if (lower.includes("not a valid email") || lower.includes("value is not a valid email")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("at least") && lower.includes("character") && field === "password") {
    return "Password is too short (at least 8 characters).";
  }
  if (lower.includes("at least") && lower.includes("character") && field === "username") {
    return "Username is too short (at least 2 characters).";
  }
  if (lower.includes("at least") && lower.includes("character")) {
    return msg;
  }
  return msg;
}

export async function apiJson<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authToken = typeof opts.token === "string" ? opts.token.trim() : opts.token;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    if (e instanceof TypeError) {
      throw new Error("Network error. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (typeof data === "object" && data !== null && "detail" in data) {
      msg = formatApiErrorDetail((data as { detail: unknown }).detail);
    } else if (typeof data === "string" && data) {
      msg = data;
    }
    if (res.status === 401 && authToken && unauthorizedHandler) {
      void Promise.resolve(unauthorizedHandler()).catch(() => undefined);
    }
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}
