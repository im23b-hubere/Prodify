import NetInfo from "@react-native-community/netinfo";

import { API_BASE_URL } from "../constants/api";
import {
  addNetworkBreadcrumb,
  canRetryMethod,
  inferDevFallbackBaseUrl,
  parseApiHost,
  retryDelayMs,
} from "./apiNetworkTelemetry";
import type { InternalApiOptions } from "./apiRequestTypes";
import i18n from "./i18n";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 600;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

type RequestContext = {
  path: string;
  baseUrl: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  retries: number;
  signal?: AbortSignal;
  fallbackUsed: boolean;
};

export async function performJsonRequest(
  path: string,
  options: InternalApiOptions,
): Promise<Response> {
  await requireNetworkConnection();
  const context = createRequestContext(path, options);
  try {
    return await fetchWithRetries(context);
  } catch (error) {
    return recoverFromTransportError(error, path, options, context);
  }
}

async function requireNetworkConnection(): Promise<void> {
  const connection = await NetInfo.fetch();
  // Reachability can be false on LAN-only development even when the API is reachable.
  if (connection.isConnected === false) throw new Error(i18n.t("errors.network"));
}

function createRequestContext(path: string, options: InternalApiOptions): RequestContext {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  if (!baseUrl) throw new Error(i18n.t("errors.serviceUnavailable"));

  const method = (options.method ?? "GET").toUpperCase();
  const authToken = normalizedToken(options.token);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const canRetry = canRetryMethod(method, options.retryUnsafeMethods);

  return {
    path,
    baseUrl,
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: canRetry ? Math.max(0, Math.min(options.retries ?? MAX_RETRIES, 4)) : 0,
    signal: options.signal,
    fallbackUsed: Boolean(options.triedBaseUrls?.length),
  };
}

async function fetchWithRetries(context: RequestContext): Promise<Response> {
  for (let attempt = 0; attempt <= context.retries; attempt += 1) {
    try {
      const response = await fetchOnce(context);
      if (shouldRetryResponse(response, attempt, context.retries)) {
        recordRetry(context, "retryable_status", attempt, response.status);
        await waitBeforeRetry(attempt);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt >= context.retries) throw error;
      recordRetry(context, "network_retry_after_error", attempt);
      await waitBeforeRetry(attempt);
    }
  }
  throw new Error(i18n.t("errors.network"));
}

async function fetchOnce(context: RequestContext): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (context.signal) {
    if (context.signal.aborted) controller.abort();
    context.signal.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs);
  try {
    return await fetch(`${context.baseUrl}${context.path}`, {
      method: context.method,
      headers: context.headers,
      body: context.body,
      signal: controller.signal,
    });
  } finally {
    if (context.signal) context.signal.removeEventListener("abort", abortFromCaller);
    clearTimeout(timeoutId);
  }
}

async function recoverFromTransportError(
  error: unknown,
  path: string,
  options: InternalApiOptions,
  context: RequestContext,
): Promise<Response> {
  if (error instanceof Error && error.name === "AbortError") {
    throw mapAbortError(context);
  }
  if (!(error instanceof TypeError)) throw error;

  const fallback = developmentFallback(options, context.baseUrl);
  if (fallback) {
    console.warn(`[api] Primary API unreachable (${context.baseUrl}), retrying via ${fallback}`);
    return performJsonRequest(path, {
      ...options,
      baseUrl: fallback,
      triedBaseUrls: [...(options.triedBaseUrls ?? []), context.baseUrl],
    });
  }

  recordNetworkFailure(context, "network_error");
  throw new Error(i18n.t("errors.network"));
}

function mapAbortError(context: RequestContext): Error {
  if (context.signal?.aborted) {
    recordNetworkFailure(context, "aborted_by_caller");
    const aborted = new Error("Request aborted by caller");
    aborted.name = "AbortError";
    return aborted;
  }
  recordNetworkFailure(context, "timeout");
  return new Error(i18n.t("errors.requestTimeout"));
}

function developmentFallback(options: InternalApiOptions, baseUrl: string): string | null {
  if (!__DEV__ || options.baseUrl) return null;
  const fallback = inferDevFallbackBaseUrl();
  return fallback && fallback !== baseUrl ? fallback : null;
}

function normalizedToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") return null;
  return token.trim() || null;
}

function shouldRetryResponse(response: Response, attempt: number, retries: number): boolean {
  return RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries;
}

function recordRetry(
  context: RequestContext,
  reason: string,
  attempt: number,
  status?: number,
): void {
  addNetworkBreadcrumb({
    method: context.method,
    path: context.path,
    timeoutMs: context.timeoutMs,
    host: parseApiHost(context.baseUrl),
    fallbackUsed: context.fallbackUsed,
    reason,
    attempt,
    status,
  });
}

function recordNetworkFailure(context: RequestContext, reason: string): void {
  addNetworkBreadcrumb({
    method: context.method,
    path: context.path,
    timeoutMs: context.timeoutMs,
    host: parseApiHost(context.baseUrl),
    fallbackUsed: context.fallbackUsed,
    reason,
  });
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, BASE_RETRY_DELAY_MS)));
}
