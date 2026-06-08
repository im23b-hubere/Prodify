/** @type {import("@expo/config").ConfigContext} */
module.exports = ({ config }) => {
  const appJson = require("./app.json");

  return {
    ...appJson.expo,
    ...config,
    extra: {
      ...appJson.expo.extra,
      ...config.extra,
      // Baked at EAS build time from Environment Variables (see eas.json → environment).
      revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "",
      revenueCatEntitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "app_access",
    },
  };
};
