const { findReleaseConfigProblems } = require("../../scripts/releaseConfigCheck");

const releaseConfig = {
  runtimeVersion: { policy: "appVersion" },
  extra: {
    appEnv: "production",
    revenueCatApiKey: "appl_live_key",
    googleWebClientId: "web.apps.googleusercontent.com",
    googleIosClientId: "ios.apps.googleusercontent.com",
  },
};
const releaseEnv = { EXPO_PUBLIC_API_URL: "https://api.prodify.app" };

describe("findReleaseConfigProblems", () => {
  it("accepts a complete production configuration", () => {
    expect(findReleaseConfigProblems({ config: releaseConfig, env: releaseEnv })).toEqual([]);
  });

  it("rejects a bundle that would target the Expo Go runtime instead of store builds", () => {
    const config = {
      ...releaseConfig,
      runtimeVersion: { policy: "sdkVersion" },
      extra: { ...releaseConfig.extra, appEnv: "development" },
    };

    expect(findReleaseConfigProblems({ config, env: releaseEnv })).toEqual(
      expect.arrayContaining([expect.stringContaining("EXPO_PUBLIC_APP_ENV")]),
    );
  });

  it("rejects a bundle without Google sign-in client ids", () => {
    const config = {
      ...releaseConfig,
      extra: { ...releaseConfig.extra, googleWebClientId: "", googleIosClientId: "" },
    };

    expect(findReleaseConfigProblems({ config, env: releaseEnv })).toHaveLength(2);
  });

  it("rejects a placeholder RevenueCat key", () => {
    const config = {
      ...releaseConfig,
      extra: { ...releaseConfig.extra, revenueCatApiKey: "your-rc-public-key" },
    };

    expect(findReleaseConfigProblems({ config, env: releaseEnv })).toEqual([
      expect.stringContaining("EXPO_PUBLIC_REVENUECAT_API_KEY"),
    ]);
  });

  it("rejects an API URL that is not https", () => {
    const env = { EXPO_PUBLIC_API_URL: "http://localhost:8000" };

    expect(findReleaseConfigProblems({ config: releaseConfig, env })).toEqual([
      expect.stringContaining("EXPO_PUBLIC_API_URL"),
    ]);
  });
});
