import { API_BASE_URL } from "../constants/api";
import {
  refreshAccessToken,
  setAuthRefreshBridge as setRefreshBridge,
  type TokenPair,
} from "./apiAuthRefresh";
import { performJsonRequest } from "./apiJsonTransport";
import type { ApiOptions, InternalApiOptions } from "./apiRequestTypes";
import { apiErrorFromResponse, readResponsePayload } from "./apiResponse";

export { ApiError } from "./apiErrors";
export { apiMultipart } from "./apiMultipart";
export type { ApiMultipartOptions } from "./apiMultipart";
export type { ApiOptions } from "./apiRequestTypes";

/** Set from AuthProvider: clear stored token when an authenticated request returns 401. */
let unauthorizedHandler: (() => void | Promise<void>) | null = null;
let apiWarmup: Promise<void> | null = null;

/** Wake the production API while the user is still entering credentials. */
export function warmApi(): Promise<void> {
  if (apiWarmup) return apiWarmup;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  apiWarmup = fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timeoutId);
      apiWarmup = null;
    });
  return apiWarmup;
}

export function setApiUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

/** Wired from AuthProvider so authenticated requests can renew expired access tokens. */
export function setAuthRefreshBridge(
  readRefreshToken: (() => Promise<string | null>) | null,
  applyTokenPair: ((pair: TokenPair) => Promise<void>) | null,
): void {
  setRefreshBridge(readRefreshToken, applyTokenPair);
}

export async function apiJson<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  return apiJsonInternal<T>(path, options);
}

async function apiJsonInternal<T>(path: string, options: InternalApiOptions): Promise<T> {
  const response = await performJsonRequest(path, options);
  const payload = await readResponsePayload(response);
  if (response.ok) return payload as T;

  const authToken = typeof options.token === "string" ? options.token.trim() : "";
  if (shouldRefresh(response.status, authToken, path, options.skipRefresh)) {
    const pair = await refreshAccessToken((refreshToken) =>
      apiJsonInternal<TokenPair>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
        skipRefresh: true,
      }),
    );
    if (pair) {
      return apiJsonInternal<T>(path, {
        ...options,
        token: pair.access_token,
        skipRefresh: true,
      });
    }
  }

  if (response.status === 401 && authToken && unauthorizedHandler) {
    void Promise.resolve(unauthorizedHandler()).catch(() => undefined);
  }
  throw apiErrorFromResponse(response, payload);
}

function shouldRefresh(
  status: number,
  authToken: string,
  path: string,
  skipRefresh: boolean | undefined,
): boolean {
  return (
    status === 401 &&
    Boolean(authToken) &&
    !skipRefresh &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    path !== "/auth/register"
  );
}
