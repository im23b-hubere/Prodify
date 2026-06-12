import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

import { getAppEnvironment } from "../constants/api";
import { getExpoPublicSentryDsn } from "../constants/env";

function isLikelyPlaceholderDsn(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  return value.includes("...") || value.includes("your-") || value.includes("<");
}

function isValidSentryDsn(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (!parsed.username || !parsed.hostname) return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const projectId = segments.at(-1);
    return Boolean(projectId && /^\d+$/.test(projectId));
  } catch {
    return false;
  }
}

/** Call once at startup. No-op if EXPO_PUBLIC_SENTRY_DSN is unset. */
export function initSentry(): void {
  const dsn = getExpoPublicSentryDsn();
  const environment = getAppEnvironment();
  if (!dsn) {
    // Keep runtime alive even when config is missing; CI/EAS should enforce this.
    console.warn("[sentry] EXPO_PUBLIC_SENTRY_DSN is missing; Sentry init skipped.");
    return;
  }
  if (isLikelyPlaceholderDsn(dsn) || !isValidSentryDsn(dsn)) {
    console.warn("[sentry] EXPO_PUBLIC_SENTRY_DSN is invalid; Sentry init skipped.");
    return;
  }

  const release = Constants.expoConfig?.version ?? "unknown";

  try {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate: __DEV__ ? 0 : 0.15,
      enableAutoSessionTracking: true,
    });
  } catch (error) {
    console.warn(
      `[sentry] Sentry init failed and was skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
