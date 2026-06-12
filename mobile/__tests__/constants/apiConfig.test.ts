describe("API config resolution", () => {
  const originalEnv = process.env;
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    Object.defineProperty(global, "__DEV__", { value: originalDev, configurable: true });
  });

  it("prefers EXPO_PUBLIC_API_URL over embedded manifest apiUrl", () => {
    process.env = { ...process.env, EXPO_PUBLIC_API_URL: "https://env.api.prodify.app" };
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        expoConfig: { extra: { apiUrl: "https://manifest.api.prodify.app" } },
        manifest: { extra: { apiUrl: "https://manifest.api.prodify.app" } },
      },
    }));

    const { getExpoPublicApiUrl } =
      require("../../constants/env") as typeof import("../../constants/env");
    expect(getExpoPublicApiUrl()).toBe("https://env.api.prodify.app");
  });

  it("throws in production when EXPO_PUBLIC_API_URL is missing", () => {
    process.env = { ...process.env };
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(global, "__DEV__", { value: false, configurable: true });
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        expoConfig: { extra: {} },
      },
    }));
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    expect(() => {
      require("../../constants/api");
    }).toThrow(/EXPO_PUBLIC_API_URL is missing/i);
  });

  it("throws in production when EXPO_PUBLIC_API_URL is not https", () => {
    process.env = { ...process.env, EXPO_PUBLIC_API_URL: "http://api.prodify.app" };
    Object.defineProperty(global, "__DEV__", { value: false, configurable: true });
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        expoConfig: { extra: {} },
      },
    }));
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    expect(() => {
      require("../../constants/api");
    }).toThrow(/must use HTTPS/i);
  });
});
