import * as Sentry from "@sentry/react-native";

import { initSentry } from "../lib/sentry";

jest.mock("expo-constants", () => ({
  expoConfig: { version: "9.9.9" },
}));

const mockGetExpoPublicSentryDsn = jest.fn();
const mockGetAppEnvironment = jest.fn();

jest.mock("../constants/env", () => ({
  getExpoPublicSentryDsn: () => mockGetExpoPublicSentryDsn(),
}));

jest.mock("../constants/api", () => ({
  getAppEnvironment: () => mockGetAppEnvironment(),
}));

describe("initSentry", () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppEnvironment.mockReturnValue("production");
  });

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("initializes sentry with release metadata when dsn is set", () => {
    mockGetExpoPublicSentryDsn.mockReturnValue("https://example@sentry.io/123");

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example@sentry.io/123",
        environment: "production",
        release: "9.9.9",
      }),
    );
  });

  it("is a no-op in dev when dsn is missing", () => {
    mockGetExpoPublicSentryDsn.mockReturnValue(null);
    (global as { __DEV__?: boolean }).__DEV__ = true;

    expect(() => initSentry()).not.toThrow();
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
