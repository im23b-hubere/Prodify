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

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /([?&](?:email|password|token|refresh_token|access_token|secret)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1[redacted]");
}

function scrubObject(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrubObject);

  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (/password|token|secret|authorization|email/i.test(key)) {
      next[key] = "[redacted]";
    } else {
      next[key] = scrubObject(raw);
    }
  }
  return next;
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
      beforeSend(event) {
        return scrubObject(event) as typeof event;
      },
      beforeBreadcrumb(breadcrumb) {
        return scrubObject(breadcrumb) as typeof breadcrumb;
      },
    });
  } catch (error) {
    console.warn(
      `[sentry] Sentry init failed and was skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
