import AsyncStorage from "@react-native-async-storage/async-storage";

export const LANGUAGE_PREFERENCE_KEY = "prodify_language_preference_v1";

export const LANGUAGE_PREFERENCES = ["system", "en", "de"] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const APP_LANGUAGES = ["en", "de"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === "string" && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (APP_LANGUAGES as readonly string[]).includes(value);
}

/** Map a stored preference + device language code onto a concrete catalog language. */
export function resolveAppLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: string | undefined,
): AppLanguage {
  if (preference !== "system") return preference;
  const code = deviceLanguageCode?.toLowerCase();
  if (code === "de") return "de";
  return "en";
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
