import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

export type NetworkBreadcrumb = {
  path: string;
  method: string;
  timeoutMs: number;
  host: string;
  fallbackUsed: boolean;
  reason: string;
  attempt?: number;
  status?: number;
};

export function parseApiHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || "unknown";
  } catch {
    return "unknown";
  }
}

export function addNetworkBreadcrumb(payload: NetworkBreadcrumb): void {
  if (typeof (Sentry as { addBreadcrumb?: unknown }).addBreadcrumb !== "function") return;
  (Sentry as { addBreadcrumb: (crumb: Record<string, unknown>) => void }).addBreadcrumb({
    category: "network",
    level: "info",
    message: `api ${payload.method} ${payload.path}`,
    data: payload,
  });
}

export function retryDelayMs(attempt: number, baseDelayMs: number): number {
  const base = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.max(100, Math.round(base * 0.35)));
  return base + jitter;
}

export function canRetryMethod(method: string, unsafeMethods?: boolean | string[]): boolean {
  if (method === "GET" || method === "HEAD") return true;
  if (!unsafeMethods) return false;
  if (unsafeMethods === true) return true;
  return unsafeMethods.some((value) => value.toUpperCase() === method);
}

export function inferDevFallbackBaseUrl(): string | null {
  const uri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
  if (!uri || typeof uri !== "string") return null;
  const host = uri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return `http://${host}:8000`;
}
