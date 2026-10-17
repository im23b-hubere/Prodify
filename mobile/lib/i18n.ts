/**
 * Internationalization
 *
 * Supported languages: English and German. Default follows the device locale
 * unless the user picks a language in Settings (see languagePreference).
 */
import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";

import de from "../locales/de.json";
import en from "../locales/en.json";
import {
  loadLanguagePreference,
  resolveAppLanguage,
  saveLanguagePreference,
  type AppLanguage,
  type LanguagePreference,
} from "./languagePreference";

const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;

export function deviceLanguageCode(): string | undefined {
  return getLocales()?.[0]?.languageCode?.toLowerCase() ?? undefined;
}

function detectLocale(): AppLanguage {
  return resolveAppLanguage("system", deviceLanguageCode());
}

// Jest keeps the English catalog as the default so UI assertions stay stable; preference
// tests still call applyLanguagePreference / changeLanguage explicitly when they need German.
const initialLanguage =
  typeof process !== "undefined" && process.env.JEST_WORKER_ID ? "en" : detectLocale();

// i18next intentionally uses default export instance methods here.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "de"],
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

/** Apply a stored preference after AsyncStorage is ready (call once from the root layout). */
export async function hydrateLanguageFromStorage(): Promise<AppLanguage> {
  const preference = await loadLanguagePreference();
  const language = resolveAppLanguage(preference, deviceLanguageCode());
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  return language;
}

/** Persist a Settings choice and switch the active catalog immediately. */
export async function applyLanguagePreference(
  preference: LanguagePreference,
): Promise<AppLanguage> {
  await saveLanguagePreference(preference);
  const language = resolveAppLanguage(preference, deviceLanguageCode());
  await i18n.changeLanguage(language);
  return language;
}

export default i18n;
