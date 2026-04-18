import { API_BASE_URL } from "../constants/api";

export type ApiOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
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
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

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
    throw new Error(msg);
  }
  return data as T;
}
