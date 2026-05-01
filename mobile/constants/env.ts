import Constants from "expo-constants";

function readPublicEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readEmbeddedApiUrlFromManifest(): string | null {
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  const fromExtra = typeof extra?.apiUrl === "string" ? extra.apiUrl.trim() : "";
  if (fromExtra) return fromExtra;

  const manifestExtra = (
    Constants.manifest as { extra?: { apiUrl?: unknown } } | null | undefined
  )?.extra;
  const fromManifest = typeof manifestExtra?.apiUrl === "string" ? manifestExtra.apiUrl.trim() : "";
  return fromManifest || null;
}

export function getExpoPublicApiUrl(): string | null {
  return readEmbeddedApiUrlFromManifest() ?? readPublicEnv("EXPO_PUBLIC_API_URL");
}

export function getExpoPublicAppEnv(): string | null {
  return readPublicEnv("EXPO_PUBLIC_APP_ENV") ?? readPublicEnv("EXPO_PUBLIC_ENV");
}

export function getExpoPublicSentryDsn(): string | null {
  return readPublicEnv("EXPO_PUBLIC_SENTRY_DSN");
}

export function getExpoPublicRevenueCatApiKey(): string | null {
  return readPublicEnv("EXPO_PUBLIC_REVENUECAT_API_KEY");
}

export function getExpoPublicRevenueCatEntitlementId(): string | null {
  return readPublicEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID");
}
