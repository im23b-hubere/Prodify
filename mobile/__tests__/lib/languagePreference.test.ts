import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  LANGUAGE_PREFERENCE_KEY,
  loadLanguagePreference,
  resolveAppLanguage,
  saveLanguagePreference,
  type LanguagePreference,
} from "../../lib/languagePreference";

describe("resolveAppLanguage", () => {
  it("uses the device language when preference is system", () => {
    expect(resolveAppLanguage("system", "de")).toBe("de");
    expect(resolveAppLanguage("system", "de-AT")).toBe("de");
    expect(resolveAppLanguage("system", "de-ch")).toBe("de");
    expect(resolveAppLanguage("system", "en")).toBe("en");
  });

  it("falls back to English for unsupported device languages", () => {
    expect(resolveAppLanguage("system", "fr")).toBe("en");
    expect(resolveAppLanguage("system", undefined)).toBe("en");
  });

  it("honors an explicit manual preference", () => {
    expect(resolveAppLanguage("en", "de")).toBe("en");
    expect(resolveAppLanguage("de", "en")).toBe("de");
  });
});

describe("language preference storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to system when nothing is stored", async () => {
    await expect(loadLanguagePreference()).resolves.toBe("system");
  });

  it("round-trips a saved preference", async () => {
    await saveLanguagePreference("de");
    await expect(loadLanguagePreference()).resolves.toBe("de");
    await expect(AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY)).resolves.toBe("de");
  });

  it("ignores corrupt storage values", async () => {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, "esperanto");
    await expect(loadLanguagePreference()).resolves.toBe("system");
  });

  it("rejects invalid preferences when saving", async () => {
    await expect(
      saveLanguagePreference("fr" as LanguagePreference),
    ).rejects.toThrow(/unsupported/i);
  });
});
