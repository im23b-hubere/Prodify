import { API_BASE_URL } from "../constants/api";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import i18n from "./i18n";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 600;
const REFRESH_ACCESS_TIMEOUT_MS = 12_000;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

/** Set from AuthProvider: clear stored token when an authenticated request returns 401. */
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setApiUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

type TokenPair = { access_token: string; refresh_token: string };

let getRefreshTokenFromStore: (() => Promise<string | null>) | null = null;
let applyTokenPair: ((pair: TokenPair) => Promise<void>) | null = null;
let inFlightRefresh: Promise<TokenPair | null> | null = null;

/** Wired from AuthProvider so apiJson can renew access tokens after expiry. */
export function setAuthRefreshBridge(
  getRt: (() => Promise<string | null>) | null,
  apply: ((pair: TokenPair) => Promise<void>) | null,
): void {
  getRefreshTokenFromStore = getRt;
  applyTokenPair = apply;
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
  retries?: number;
  /** Enable retries for non-idempotent methods only when explicitly intended. */
  retryUnsafeMethods?: boolean | string[];
  signal?: AbortSignal;
  /** Internal: do not attempt refresh (avoids recursion). */
  _skipRefresh?: boolean;
  /** Internal: force a specific base URL (used by dev fallback). */
  _baseUrl?: string;
  /** Internal: base URLs already attempted for this request. */
  _triedBaseUrls?: string[];
};

type NetworkBreadcrumb = {
  path: string;
  method: string;
  timeoutMs: number;
  host: string;
  fallbackUsed: boolean;
  reason: string;
  attempt?: number;
  status?: number;
};

export type ApiMultipartOptions = {
  token?: string | null;
  method?: "POST" | "PUT" | "PATCH";
  formData: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function parseHostFromBaseUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    return parsed.host || "unknown";
  } catch {
    return "unknown";
  }
}

function addNetworkBreadcrumb(payload: NetworkBreadcrumb): void {
  if (typeof (Sentry as { addBreadcrumb?: unknown }).addBreadcrumb === "function") {
    (Sentry as { addBreadcrumb: (crumb: Record<string, unknown>) => void }).addBreadcrumb({
      category: "network",
      level: "info",
      message: `api ${payload.method} ${payload.path}`,
      data: {
        method: payload.method,
        path: payload.path,
        host: payload.host,
        timeoutMs: payload.timeoutMs,
        fallbackUsed: payload.fallbackUsed,
        reason: payload.reason,
        attempt: payload.attempt,
        status: payload.status,
      },
    });
  }
}

function getRetryDelayMs(attempt: number): number {
  const base = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.max(100, Math.round(base * 0.35)));
  return base + jitter;
}

function canRetryMethod(method: string, retryUnsafeMethods?: boolean | string[]): boolean {
  if (method === "GET" || method === "HEAD") return true;
  if (!retryUnsafeMethods) return false;
  if (retryUnsafeMethods === true) return true;
  const allowed = new Set(retryUnsafeMethods.map((value) => value.toUpperCase()));
  return allowed.has(method);
}

function inferDevFallbackBaseUrl(): string | null {
  const uri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;

  if (!uri || typeof uri !== "string") return null;
  const host = uri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return `http://${host}:8000`;
}

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
    const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : null;

    lines.push(humanizeValidationMessage(msg, field));
  }
  return lines.join("\n");
}

function humanizeValidationMessage(msg: string, field: string | null): string {
  const lower = msg.toLowerCase();
  if (lower.includes("not a valid email") || lower.includes("value is not a valid email")) {
    return i18n.t("errors.validation.email");
  }
  if (lower.includes("at least") && lower.includes("character") && field === "password") {
    return i18n.t("errors.validation.passwordShort");
  }
  if (lower.includes("at least") && lower.includes("character") && field === "username") {
    return i18n.t("errors.validation.usernameShort");
  }
  if (lower.includes("at least") && lower.includes("character")) {
    return msg;
  }
  return msg;
}

async function tryRefreshAccessToken(): Promise<TokenPair | null> {
  if (inFlightRefresh) {
    try {
      return await inFlightRefresh;
    } catch {
      return null;
    }
  }
  const refreshPromise = (async (): Promise<TokenPair | null> => {
    if (!getRefreshTokenFromStore || !applyTokenPair) return null;
    const rt = await getRefreshTokenFromStore();
    if (!rt?.trim()) return null;
    try {
      const refreshCall = apiJson<TokenPair>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: rt.trim() },
        _skipRefresh: true,
      });
      const data = await Promise.race([
        refreshCall,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), REFRESH_ACCESS_TIMEOUT_MS)),
      ]);
      if (!data) return null;
      if (typeof data.access_token === "string" && typeof data.refresh_token === "string") {
        await applyTokenPair({
          access_token: data.access_token.trim(),
          refresh_token: data.refresh_token.trim(),
        });
        return {
          access_token: data.access_token.trim(),
          refresh_token: data.refresh_token.trim(),
        };
      }
    } catch {
      /* handled below */
    }
    return null;
  })();
  inFlightRefresh = refreshPromise;
  try {
    return await refreshPromise;
  } finally {
    if (inFlightRefresh === refreshPromise) {
      inFlightRefresh = null;
    }
  }
}

export async function apiJson<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const baseUrl = opts._baseUrl ?? API_BASE_URL;
  const triedBaseUrls = opts._triedBaseUrls ?? [];
  if (!baseUrl) {
    throw new Error(i18n.t("errors.serviceUnavailable"));
  }
  const connection = await NetInfo.fetch();
  // Only treat explicit "disconnected" as offline. `isInternetReachable === false` is common on
  // LAN-only dev (phone → PC API) even when requests work; blocking it breaks flows like DELETE /users/me.
  if (connection.isConnected === false) {
    throw new Error(i18n.t("errors.network"));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authToken = typeof opts.token === "string" ? opts.token.trim() : opts.token;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (opts.method ?? "GET").toUpperCase();
  const allowRetry = canRetryMethod(method, opts.retryUnsafeMethods);
  const retries = allowRetry ? Math.max(0, Math.min(opts.retries ?? MAX_RETRIES, 4)) : 0;
  const host = parseHostFromBaseUrl(baseUrl);

  let res: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const externalSignal = opts.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
      clearTimeout(timeoutId);
      if (attempt < retries) {
        addNetworkBreadcrumb({
          method,
          path,
          timeoutMs,
          host,
          fallbackUsed: triedBaseUrls.length > 0,
          reason: "network_retry_after_error",
          attempt,
        });
        await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt)));
        continue;
      }
      if (e instanceof Error && e.name === "AbortError") {
        if (externalSignal?.aborted) {
          addNetworkBreadcrumb({
            method,
            path,
            timeoutMs,
            host,
            fallbackUsed: triedBaseUrls.length > 0,
            reason: "aborted_by_caller",
          });
          const aborted = new Error("Request aborted by caller");
          aborted.name = "AbortError";
          throw aborted;
        }
        addNetworkBreadcrumb({
          method,
          path,
          timeoutMs,
          host,
          fallbackUsed: triedBaseUrls.length > 0,
          reason: "timeout",
        });
        throw new Error(i18n.t("errors.requestTimeout"));
      }
      if (e instanceof TypeError) {
        if (__DEV__ && !opts._baseUrl) {
          const fallbackBaseUrl = inferDevFallbackBaseUrl();
          if (fallbackBaseUrl && fallbackBaseUrl !== baseUrl) {
            console.warn(
              `[api] Primary API unreachable (${baseUrl}), retrying via ${fallbackBaseUrl}`,
            );
            return apiJson<T>(path, { ...opts, _baseUrl: fallbackBaseUrl });
          }
        }
        addNetworkBreadcrumb({
          method,
          path,
          timeoutMs,
          host,
          fallbackUsed: triedBaseUrls.length > 0,
          reason: "network_error",
        });
        throw new Error(i18n.t("errors.network"));
      }
      throw e;
    }
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
    clearTimeout(timeoutId);
    if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < retries) {
      addNetworkBreadcrumb({
        method,
        path,
        timeoutMs,
        host,
        fallbackUsed: triedBaseUrls.length > 0,
        reason: "retryable_status",
        attempt,
        status: res.status,
      });
      await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt)));
      continue;
    }
    break;
  }
  if (!res) throw new Error(i18n.t("errors.network"));

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (typeof data === "object" && data !== null) {
      let fromErrorShape = false;
      if ("error" in data && typeof (data as { error?: unknown }).error === "object") {
        const errObj = (data as { error: { message?: unknown } }).error;
        if (errObj && "message" in errObj && typeof errObj.message === "string") {
          msg = errObj.message;
          fromErrorShape = true;
        }
      }
      if (!fromErrorShape && "detail" in data) {
        msg = formatApiErrorDetail((data as { detail: unknown }).detail);
      }
    } else if (typeof data === "string" && data) {
      msg = data;
    }

    if (
      res.status === 401 &&
      authToken &&
      !opts._skipRefresh &&
      path !== "/auth/refresh" &&
      path !== "/auth/login" &&
      path !== "/auth/register"
    ) {
      const pair = await tryRefreshAccessToken();
      if (pair) {
        return apiJson<T>(path, { ...opts, token: pair.access_token, _skipRefresh: true });
      }
    }

    if (res.status === 401 && authToken && unauthorizedHandler) {
      void Promise.resolve(unauthorizedHandler()).catch(() => undefined);
    }
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export async function apiMultipart<T = unknown>(
  path: string,
  { token, method = "POST", formData, timeoutMs = DEFAULT_TIMEOUT_MS, signal }: ApiMultipartOptions,
): Promise<T> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const host = parseHostFromBaseUrl(API_BASE_URL);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined,
      body: formData,
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = raw;
    }
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      if (typeof payload === "object" && payload && "detail" in payload) {
        message = formatApiErrorDetail((payload as { detail: unknown }).detail);
      } else if (typeof payload === "string" && payload.trim()) {
        message = payload;
      }
      throw new ApiError(response.status, message, payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (signal?.aborted) {
        addNetworkBreadcrumb({
          method,
          path,
          timeoutMs,
          host,
          fallbackUsed: false,
          reason: "upload_aborted_by_caller",
        });
        const aborted = new Error("Request aborted by caller");
        aborted.name = "AbortError";
        throw aborted;
      }
      addNetworkBreadcrumb({
        method,
        path,
        timeoutMs,
        host,
        fallbackUsed: false,
        reason: "upload_timeout",
      });
      throw new Error(i18n.t("errors.requestTimeout"));
    }
    if (error instanceof TypeError) {
      addNetworkBreadcrumb({
        method,
        path,
        timeoutMs,
        host,
        fallbackUsed: false,
        reason: "upload_network_error",
      });
      throw new Error(i18n.t("errors.network"));
    }
    throw error;
  } finally {
    if (signal) signal.removeEventListener("abort", onExternalAbort);
    clearTimeout(timeoutId);
  }
}
