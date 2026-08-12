import { API_BASE_URL } from "../constants/api";
import { apiErrorFromResponse, readResponsePayload } from "./apiResponse";
import { addNetworkBreadcrumb, parseApiHost } from "./apiNetworkTelemetry";
import i18n from "./i18n";

export type ApiMultipartOptions = {
  token?: string | null;
  method?: "POST" | "PUT" | "PATCH";
  formData: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiMultipart<T = unknown>(
  path: string,
  { token, method = "POST", formData, timeoutMs = 30_000, signal }: ApiMultipartOptions,
): Promise<T> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const host = parseApiHost(API_BASE_URL);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined,
      body: formData,
      signal: controller.signal,
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) throw apiErrorFromResponse(response, payload);
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
