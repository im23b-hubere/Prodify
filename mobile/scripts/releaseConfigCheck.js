/**
 * Guards OTA publishes: a bundle built with the wrong env silently targets no device (wrong
 * runtime) or ships broken sign-in/billing to every store user on that app version.
 */
function isMissingOrPlaceholder(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return !trimmed || trimmed.toLowerCase().startsWith("your-") || trimmed.includes("...");
}

function findReleaseConfigProblems({ config, env }) {
  const extra = config.extra ?? {};
  const problems = [];

  if (extra.appEnv !== "production" || config.runtimeVersion?.policy !== "appVersion") {
    problems.push(
      "EXPO_PUBLIC_APP_ENV must be 'production' so the update targets the store builds' runtime.",
    );
  }
  if (isMissingOrPlaceholder(extra.revenueCatApiKey)) {
    problems.push("EXPO_PUBLIC_REVENUECAT_API_KEY is missing or a placeholder.");
  }
  if (isMissingOrPlaceholder(extra.googleWebClientId)) {
    problems.push("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.");
  }
  if (isMissingOrPlaceholder(extra.googleIosClientId)) {
    problems.push("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is missing.");
  }
  if (!env.EXPO_PUBLIC_API_URL?.startsWith("https://")) {
    problems.push("EXPO_PUBLIC_API_URL must be an https:// URL.");
  }
  return problems;
}

module.exports = { findReleaseConfigProblems };
