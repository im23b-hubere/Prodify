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

import "./lib/i18n";
