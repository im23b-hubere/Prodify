/**
 * Internationalization
 *
 * Supported languages: English only for now. Additional locales (e.g. German for DACH)
 * can be added by extending `resources` and `supportedLngs`.
 */
import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";

const resources = {
  en: { translation: en },
} as const;

function detectLocale(): string {
  const locale = getLocales()?.[0]?.languageCode?.toLowerCase();
  if (!locale) return "en";
  return locale === "en" ? "en" : "en";
}

// i18next intentionally uses default export instance methods here.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: "en",
  supportedLngs: ["en"],
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

export default i18n;
