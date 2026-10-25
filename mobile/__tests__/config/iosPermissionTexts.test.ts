type PluginEntry = string | [string, Record<string, unknown>];
type ExpoConfig = {
  ios: { infoPlist: Record<string, unknown> };
  plugins: PluginEntry[];
  locales: Record<string, string>;
};
type AppConfigFactory = (context: { config: Record<string, unknown> }) => ExpoConfig;
type NativeLocale = { ios: Record<string, string> };

function loadAppConfig(): ExpoConfig {
  let factory!: AppConfigFactory;
  jest.isolateModules(() => {
    factory = require("../../app.config.js");
  });
  return factory({ config: {} });
}

function pluginOptions(config: ExpoConfig, name: string): Record<string, unknown> {
  const entry = config.plugins.find(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name,
  );
  return Array.isArray(entry) ? entry[1] : {};
}

/** Every permission text iOS can show for this app, whether set directly or through a plugin. */
function declaredPermissionKeys(config: ExpoConfig): string[] {
  const direct = Object.keys(config.ios.infoPlist).filter((key) =>
    key.endsWith("UsageDescription"),
  );
  const photos = pluginOptions(config, "expo-image-picker").photosPermission;
  const viaPlugin = typeof photos === "string" ? ["NSPhotoLibraryUsageDescription"] : [];
  return [...new Set([...direct, ...viaPlugin])].sort();
}

function nativeLocale(path: string): NativeLocale {
  return require(`../../${path.replace(/^\.\//, "")}`) as NativeLocale;
}

describe("iOS permission texts", () => {
  it("explains saving to Photos, which the share sheet offers for every shared card", () => {
    const text = loadAppConfig().ios.infoPlist.NSPhotoLibraryAddUsageDescription;

    expect(typeof text === "string" && text.trim().length > 0).toBe(true);
  });

  it("translates exactly the permission texts the app declares into every app language", () => {
    const config = loadAppConfig();
    const declared = declaredPermissionKeys(config);

    for (const [language, path] of Object.entries(config.locales)) {
      const translated = Object.entries(nativeLocale(path).ios)
        .filter(([key, text]) => key.endsWith("UsageDescription") && text.trim().length > 0)
        .map(([key]) => key)
        .sort();
      expect({ language, translated }).toEqual({ language, translated: declared });
    }
  });
});
