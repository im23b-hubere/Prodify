import "./lib/i18n";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "de", regionCode: "DE" }],
  locale: "de-DE",
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleLog = console.log.bind(console);

jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("not wrapped in act")) {
    return;
  }
  originalConsoleError(...(args as Parameters<typeof console.error>));
});
jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
  const first = args[0];
  if (
    typeof first === "string" &&
    first.includes("[sentry] EXPO_PUBLIC_SENTRY_DSN is missing; Sentry init skipped.")
  ) {
    return;
  }
  originalConsoleWarn(...(args as Parameters<typeof console.warn>));
});
jest.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.startsWith("[api] ")) {
    return;
  }
  originalConsoleLog(...(args as Parameters<typeof console.log>));
});
