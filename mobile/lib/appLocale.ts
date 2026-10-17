import type { AppLanguage } from "./languagePreference";
import i18n from "./i18n";

/** BCP-47 tag for Intl / toLocale* formatters from an app language code. */
export function appLocaleTag(language: AppLanguage): string {
  // en-GB keeps day-first dates (e.g. share cards: "07 OCT 2026") matching the design.
  return language === "de" ? "de-DE" : "en-GB";
}

/** Active app UI locale for dates, numbers, and share-card dates. */
export function currentAppLocaleTag(): string {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
  return appLocaleTag(language === "de" ? "de" : "en");
}
