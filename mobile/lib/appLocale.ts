import {
  APP_LANGUAGE_DEFINITIONS,
  FALLBACK_APP_LANGUAGE,
  isAppLanguage,
  type AppLanguage,
} from "./i18nLanguages";
import i18n from "./i18n";

/** BCP-47 tag for Intl / toLocale* formatters from an app language code. */
export function appLocaleTag(language: AppLanguage): string {
  return APP_LANGUAGE_DEFINITIONS[language].localeTag;
}

/** Active app UI locale for dates, numbers, and share-card dates. */
export function currentAppLocaleTag(): string {
  const code = (i18n.resolvedLanguage ?? i18n.language ?? FALLBACK_APP_LANGUAGE).split("-")[0] ?? FALLBACK_APP_LANGUAGE;
  const language = isAppLanguage(code) ? code : FALLBACK_APP_LANGUAGE;
  return appLocaleTag(language);
}
