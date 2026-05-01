import Constants from "expo-constants";
import { Platform } from "react-native";
import { getExpoPublicApiUrl, getExpoPublicAppEnv } from "./env";

/**
 * User-visible copy lives in locales/en.json (react-i18next).
 *
 * Override with EXPO_PUBLIC_API_URL when needed.
 *
 * In dev, without EXPO_PUBLIC_API_URL, we infer the machine IP from Metro (e.g. `192.168.x.x:8081`)
 * so a physical phone can reach your PC. Simulators still use loopback / 10.0.2.2.
 *
 * For a real device you must also run the API on all interfaces, e.g.:
 *   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
 * (Default uvicorn often binds only 127.0.0.1, which phones on Wi‑Fi cannot reach.)
 */
const loopbackApiUrl = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";

function inferDevApiUrlFromMetroHost(): string | null {
  const uri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;

  if (!uri || typeof uri !== "string") return null;

  const host = uri.split(":")[0]?.trim();
  if (!host) return null;

  if (host === "localhost" || host === "127.0.0.1") return null;

  return `http://${host}:8000`;
}

function isLoopbackApiUrl(url: string): boolean {
  try {
    const u = new URL(url.includes("://") ? url : `http://${url}`);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /127\.0\.0\.1|localhost/i.test(url);
  }
}

function getApiUrl(): string {
  const envUrl = getExpoPublicApiUrl();
  const fromMetro = inferDevApiUrlFromMetroHost();
  const productionFallback = "https://prodify-api-46b1.onrender.com";

  // Release / EAS builds: require a real remote API URL (not loopback).
  if (!__DEV__) {
    if (!envUrl?.trim()) {
      console.warn(
        `[api] EXPO_PUBLIC_API_URL missing in production build; falling back to ${productionFallback}.`,
      );
      return productionFallback;
    }
    if (isLoopbackApiUrl(envUrl) || /10\.0\.2\.2/i.test(envUrl)) {
      console.warn(
        `[api] Invalid loopback EXPO_PUBLIC_API_URL in production (${envUrl}); falling back to ${productionFallback}.`,
      );
      return productionFallback;
    }
    if (!/^https:\/\//i.test(envUrl)) {
      console.warn("[api] Production API should use HTTPS.");
    }
  }

  if (envUrl) {
    // .env often uses 127.0.0.1; on a physical phone that targets the device, not your PC.
    // If Metro exposes a LAN host (Expo Go QR), prefer it in dev when env is loopback.
    if (__DEV__ && fromMetro && isLoopbackApiUrl(envUrl)) {
      return fromMetro;
    }
    return envUrl;
  }

  if (fromMetro) return fromMetro;

  return loopbackApiUrl;
}

/** EAS profile / env (development | preview | production). Used for tags and Sentry. */
export function getAppEnvironment(): string {
  const raw = getExpoPublicAppEnv();
  if (raw) return raw;
  return __DEV__ ? "development" : "production";
}

export const API_BASE_URL = getApiUrl();

if (__DEV__) {
  console.log(`[api] ${API_BASE_URL} (${getAppEnvironment()})`);
}
