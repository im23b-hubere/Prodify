import AsyncStorage from "@react-native-async-storage/async-storage";

import i18n, { applyLanguagePreference, hydrateLanguageFromStorage } from "../../lib/i18n";
import { LANGUAGE_PREFERENCE_KEY } from "../../lib/languagePreference";

describe("i18n language preference", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("hydrates a stored German preference over the device default", async () => {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, "de");
    await expect(hydrateLanguageFromStorage()).resolves.toBe("de");
    expect(i18n.language).toBe("de");
  });

  it("pins English even when the device locale is German", async () => {
    await applyLanguagePreference("en");
    expect(i18n.language).toBe("en");
    await expect(AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY)).resolves.toBe("en");
  });

  it("follows the device locale again after choosing system", async () => {
    // jest.setup mocks expo-localization to German.
    await applyLanguagePreference("system");
    expect(i18n.language).toBe("de");
  });
});
