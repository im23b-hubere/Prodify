import {
  APP_LANGUAGES,
  DEVICE_LANGUAGE_ALIASES,
  FALLBACK_APP_LANGUAGE,
  matchDeviceToAppLanguage,
  type AppLanguage,
} from "./i18nLanguages";

/** The parts of an expo-localization `Locale` the app language is picked from. */
export type DeviceLocale = {
  languageTag?: string | null;
  languageCode?: string | null;
  regionCode?: string | null;
};

/** Regions whose users get the matching catalog when none of their languages is in it. */
const REGION_LANGUAGES: Readonly<Record<string, AppLanguage>> = {
  DE: "de",
  AT: "de",
  CH: "de",
  LI: "de",
};

const NO_MATCH = "";

/**
 * The app language for a device. The language is chosen in iOS / Android settings
 * (per-app or system-wide), so this walks the user's preferred languages in order;
 * if none is in the catalog, the region decides; otherwise English.
 */
export function resolveDeviceLanguage(locales: readonly DeviceLocale[]): AppLanguage {
  for (const locale of locales) {
    const tag = locale.languageTag || locale.languageCode || undefined;
    const match = matchDeviceToAppLanguage<AppLanguage | typeof NO_MATCH>(
      tag ?? undefined,
      APP_LANGUAGES,
      NO_MATCH,
      DEVICE_LANGUAGE_ALIASES,
    );
    if (match !== NO_MATCH) return match;
  }
  const region = locales[0]?.regionCode?.toUpperCase();
  return (region && REGION_LANGUAGES[region]) || FALLBACK_APP_LANGUAGE;
}
