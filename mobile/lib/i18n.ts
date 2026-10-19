/**
 * Internationalization
 *
 * Catalog languages live in `i18nLanguages.ts`. There is no in-app picker: the language
 * comes from the phone (per-app language in iOS / Android settings, else the system
 * languages, else the region), see `deviceLanguage.ts`.
 */
import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";
import { AppState } from "react-native";

import { resolveDeviceLanguage } from "./deviceLanguage";
import { APP_LANGUAGES, FALLBACK_APP_LANGUAGE, buildI18nResources } from "./i18nLanguages";

const resources = buildI18nResources();

export function detectDeviceLanguage() {
  return resolveDeviceLanguage(getLocales() ?? []);
}

const isJest = typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);

// Jest keeps English as the default so UI assertions stay stable; tests that need
// another locale call changeLanguage themselves.
const initialLanguage = isJest ? FALLBACK_APP_LANGUAGE : detectDeviceLanguage();

// i18next intentionally uses default export instance methods here.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: FALLBACK_APP_LANGUAGE,
  supportedLngs: [...APP_LANGUAGES],
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

// Changing the language in the phone's settings sends the user back here: pick it up.
if (!isJest) {
  AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    const language = detectDeviceLanguage();
    // eslint-disable-next-line import/no-named-as-default-member
    if (i18n.language !== language) void i18n.changeLanguage(language);
  });
}

export default i18n;
