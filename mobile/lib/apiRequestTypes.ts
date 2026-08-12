export type ApiOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  /** Enable retries for non-idempotent methods only when explicitly intended. */
  retryUnsafeMethods?: boolean | string[];
  signal?: AbortSignal;
};

export type InternalApiOptions = ApiOptions & {
  /** Internal: do not attempt refresh (avoids recursion). */
  skipRefresh?: boolean;
  /** Internal: force a specific base URL (used by the development fallback). */
  baseUrl?: string;
  /** Internal: base URLs already attempted for this request. */
  triedBaseUrls?: string[];
};
