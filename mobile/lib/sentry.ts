import * as Sentry from "@sentry/react-native";

import { getAppEnvironment } from "../constants/api";

/** Call once at startup. No-op if EXPO_PUBLIC_SENTRY_DSN is unset. */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: getAppEnvironment(),
    tracesSampleRate: __DEV__ ? 0 : 0.15,
    enableAutoSessionTracking: true,
  });
}
