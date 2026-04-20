import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

import { getAppEnvironment } from "../constants/api";
import { getExpoPublicSentryDsn } from "../constants/env";

/** Call once at startup. No-op if EXPO_PUBLIC_SENTRY_DSN is unset. */
export function initSentry(): void {
  const dsn = getExpoPublicSentryDsn();
  const environment = getAppEnvironment();
  if (!dsn) {
    if (!__DEV__) {
      throw new Error("EXPO_PUBLIC_SENTRY_DSN must be set for production builds.");
    }
    return;
  }

  const release = Constants.expoConfig?.version ?? "unknown";

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: __DEV__ ? 0 : 0.15,
    enableAutoSessionTracking: true,
  });
}
