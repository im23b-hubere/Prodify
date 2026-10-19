import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  APP_LANGUAGES,
  DEVICE_LANGUAGE_ALIASES,
  FALLBACK_APP_LANGUAGE,
  isAppLanguage,
  matchDeviceToAppLanguage,
  type AppLanguage,
} from "./i18nLanguages";

export const LANGUAGE_PREFERENCE_KEY = "prodify_language_preference_v1";

export type { AppLanguage };
export { APP_LANGUAGES, FALLBACK_APP_LANGUAGE, isAppLanguage };

/** Stored choice: follow the phone, or pin a registered catalog language. */
export type LanguagePreference = "system" | AppLanguage;

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "system" || isAppLanguage(value);
}

/** Map a stored preference + device language code onto a concrete catalog language. */
export function resolveAppLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: string | undefined,
): AppLanguage {
  if (preference !== "system") {
    return isAppLanguage(preference) ? preference : FALLBACK_APP_LANGUAGE;
  }
  return matchDeviceToAppLanguage(
    deviceLanguageCode,
    APP_LANGUAGES,
    FALLBACK_APP_LANGUAGE,
    DEVICE_LANGUAGE_ALIASES,
  );
}

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    if (isLanguagePreference(raw)) return raw;
  } catch {
    // Fall through to system default.
  }
  return "system";
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  if (!isLanguagePreference(preference)) {
    throw new Error(`Unsupported language preference: ${String(preference)}`);
  }
  await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
}
