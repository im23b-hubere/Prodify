/** @type {import("@expo/config").ConfigContext} */
module.exports = ({ config }) => {
  const appJson = require("./app.json");

  const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? "";
  const revenueCatEntitlementId =
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "app_access";
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";
  const appEnv =
    process.env.EXPO_PUBLIC_APP_ENV?.trim() || process.env.EXPO_PUBLIC_ENV?.trim() || "";
  const e2eMode = process.env.EXPO_PUBLIC_E2E_MODE === "true";
  const e2eTestEmail =
    process.env.EXPO_PUBLIC_E2E_TEST_EMAIL?.trim() ||
    process.env.E2E_TEST_EMAIL?.trim() ||
    (e2eMode ? "test@prodify.app" : "");
  const e2eTestPassword =
    process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD ||
    process.env.E2E_TEST_PASSWORD ||
    (e2eMode ? "Test1234!" : "");
  const invalidSentryDsn =
    !sentryDsn ||
    sentryDsn.startsWith("@") ||
    sentryDsn.includes("...") ||
    sentryDsn.toLowerCase().includes("your-");

  if (process.env.EAS_BUILD === "true" && !revenueCatApiKey) {
    throw new Error(
      "EXPO_PUBLIC_REVENUECAT_API_KEY is missing during EAS build. Add it to eas.json production env or EAS Environment (production).",
    );
  }

  if (
    process.env.EAS_BUILD === "true" &&
    appEnv === "production" &&
    process.env.EXPO_PUBLIC_E2E_MODE === "true"
  ) {
    throw new Error("EXPO_PUBLIC_E2E_MODE must never be enabled for production EAS builds.");
  }

  if (process.env.EAS_BUILD === "true" && appEnv === "production" && invalidSentryDsn) {
    throw new Error("EXPO_PUBLIC_SENTRY_DSN must be a real DSN for production EAS builds.");
  }

  return {
    ...appJson.expo,
    ...config,
    extra: {
      ...appJson.expo.extra,
      ...config.extra,
      // Baked at EAS build time from Environment Variables (see eas.json → environment).
      revenueCatApiKey,
      revenueCatEntitlementId,
      e2eTestEmail,
      e2eTestPassword,
    },
  };
};
