import Constants from "expo-constants";
import { Platform } from "react-native";

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

function getApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;

  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_URL must be set for production builds.");
  }

  const fromMetro = inferDevApiUrlFromMetroHost();
  if (fromMetro) return fromMetro;

  return loopbackApiUrl;
}

/** EAS profile / env (development | preview | production). Used for tags and Sentry. */
export function getAppEnvironment(): string {
  const raw = process.env.EXPO_PUBLIC_APP_ENV?.trim();
  if (raw) return raw;
  return __DEV__ ? "development" : "production";
}

export const API_BASE_URL = getApiUrl();
