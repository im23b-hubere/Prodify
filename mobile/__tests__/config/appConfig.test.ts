type ExpoConfig = { plugins: unknown[] };
type AppConfigFactory = (context: { config: Record<string, unknown> }) => ExpoConfig;

const releaseEnv = {
  EAS_BUILD: "true",
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_REVENUECAT_API_KEY: "appl_test_key",
  EXPO_PUBLIC_SENTRY_DSN: "https://key@o0.ingest.sentry.io/1",
};

function loadAppConfig(env: Record<string, string>): ExpoConfig {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };
  try {
    let factory!: AppConfigFactory;
    jest.isolateModules(() => {
      factory = require("../../app.config.js");
    });
    return factory({ config: {} });
  } finally {
    process.env = originalEnv;
  }
}

describe("app.config.js", () => {
  it("ships production store builds without the development client", () => {
    const config = loadAppConfig({ ...releaseEnv, EAS_BUILD_PROFILE: "production" });

    expect(config.plugins).not.toContain("expo-dev-client");
  });

  it("ships staging builds without the development client", () => {
    const config = loadAppConfig({
      ...releaseEnv,
      EXPO_PUBLIC_APP_ENV: "staging",
      EAS_BUILD_PROFILE: "staging",
    });

    expect(config.plugins).not.toContain("expo-dev-client");
  });

  it("includes the development client in development builds", () => {
    const config = loadAppConfig({
      ...releaseEnv,
      EXPO_PUBLIC_APP_ENV: "development",
      EAS_BUILD_PROFILE: "development",
    });

    expect(config.plugins).toContain("expo-dev-client");
  });
});
