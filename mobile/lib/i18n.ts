/**
 * Internationalization
 *
 * Catalog languages live in `i18nLanguages.ts`. Default follows the device locale
 * (System) unless the user pins a language in Settings.
 */
import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";

import {
  APP_LANGUAGES,
  FALLBACK_APP_LANGUAGE,
  buildI18nResources,
} from "./i18nLanguages";
import {
  loadLanguagePreference,
  resolveAppLanguage,
  saveLanguagePreference,
  type AppLanguage,
  type LanguagePreference,
} from "./languagePreference";

const resources = buildI18nResources();

/** Prefer the full BCP-47 tag so zh-Hans / pt-BR can match registered catalogs. */
export function deviceLanguageCode(): string | undefined {
  const locale = getLocales()?.[0];
  if (!locale) return undefined;
  const tag = locale.languageTag?.toLowerCase();
  if (tag) return tag;
  return locale.languageCode?.toLowerCase() ?? undefined;
}

function detectLocale(): AppLanguage {
  return resolveAppLanguage("system", deviceLanguageCode());
}

// Jest keeps English as the default so UI assertions stay stable; preference
// tests still call applyLanguagePreference / changeLanguage when they need another locale.
const initialLanguage =
  typeof process !== "undefined" && process.env.JEST_WORKER_ID
    ? FALLBACK_APP_LANGUAGE
    : detectLocale();

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
