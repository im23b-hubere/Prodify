/** @type {import("@expo/config").ConfigContext} */
module.exports = ({ config }) => {
  const appJson = require("./app.json");

  const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? "";
  const revenueCatEntitlementId =
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "app_access";

  if (process.env.EAS_BUILD === "true" && !revenueCatApiKey) {
    throw new Error(
      "EXPO_PUBLIC_REVENUECAT_API_KEY is missing during EAS build. Add it to eas.json production env or EAS Environment (production).",
    );
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
    },
  };
};
