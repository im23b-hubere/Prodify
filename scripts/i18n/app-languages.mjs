/**
 * App Store / iOS UI languages for Prodify.
 * English variants share `en`; French Canada → `fr`; Spanish variants → `es`.
 * `googleTo` is the Google Translate target; null = keep existing file (en/de).
 */
export const APP_UI_LANGUAGES = [
  { code: "en", localeTag: "en-GB", nativeName: "English", googleTo: null },
  { code: "de", localeTag: "de-DE", nativeName: "Deutsch", googleTo: null },
];

/**
 * Not shipped yet. Machine translation alone left some catalogs half English, so a
 * language moves up into APP_UI_LANGUAGES only once its file has been reviewed.
 * Add it to `supportedLocales` of expo-localization in mobile/app.json at the same time.
 * Arabic, Hebrew and Urdu also need right-to-left layout support before they can ship.
 */
export const PLANNED_UI_LANGUAGES = [
  { code: "ar", localeTag: "ar-SA", nativeName: "العربية", googleTo: "ar" },
  { code: "bn", localeTag: "bn-BD", nativeName: "বাংলা", googleTo: "bn" },
  { code: "ca", localeTag: "ca-ES", nativeName: "Català", googleTo: "ca" },
  { code: "zh-Hans", localeTag: "zh-Hans", nativeName: "简体中文", googleTo: "zh-CN" },
  { code: "zh-Hant", localeTag: "zh-Hant", nativeName: "繁體中文", googleTo: "zh-TW" },
  { code: "hr", localeTag: "hr-HR", nativeName: "Hrvatski", googleTo: "hr" },
  { code: "cs", localeTag: "cs-CZ", nativeName: "Čeština", googleTo: "cs" },
  { code: "da", localeTag: "da-DK", nativeName: "Dansk", googleTo: "da" },
  { code: "nl", localeTag: "nl-NL", nativeName: "Nederlands", googleTo: "nl" },
  { code: "fi", localeTag: "fi-FI", nativeName: "Suomi", googleTo: "fi" },
  { code: "fr", localeTag: "fr-FR", nativeName: "Français", googleTo: "fr" },
  { code: "el", localeTag: "el-GR", nativeName: "Ελληνικά", googleTo: "el" },
  { code: "gu", localeTag: "gu-IN", nativeName: "ગુજરાતી", googleTo: "gu" },
  { code: "he", localeTag: "he-IL", nativeName: "עברית", googleTo: "he" },
  { code: "hi", localeTag: "hi-IN", nativeName: "हिन्दी", googleTo: "hi" },
  { code: "hu", localeTag: "hu-HU", nativeName: "Magyar", googleTo: "hu" },
  { code: "id", localeTag: "id-ID", nativeName: "Bahasa Indonesia", googleTo: "id" },
  { code: "it", localeTag: "it-IT", nativeName: "Italiano", googleTo: "it" },
  { code: "ja", localeTag: "ja-JP", nativeName: "日本語", googleTo: "ja" },
  { code: "kn", localeTag: "kn-IN", nativeName: "ಕನ್ನಡ", googleTo: "kn" },
  { code: "ko", localeTag: "ko-KR", nativeName: "한국어", googleTo: "ko" },
  { code: "ms", localeTag: "ms-MY", nativeName: "Bahasa Melayu", googleTo: "ms" },
  { code: "ml", localeTag: "ml-IN", nativeName: "മലയാളം", googleTo: "ml" },
  { code: "mr", localeTag: "mr-IN", nativeName: "मराठी", googleTo: "mr" },
  { code: "nb", localeTag: "nb-NO", nativeName: "Norsk Bokmål", googleTo: "no" },
  { code: "or", localeTag: "or-IN", nativeName: "ଓଡ଼ିଆ", googleTo: "or" },
  { code: "pl", localeTag: "pl-PL", nativeName: "Polski", googleTo: "pl" },
  { code: "pt-BR", localeTag: "pt-BR", nativeName: "Português (Brasil)", googleTo: "pt" },
  { code: "pt-PT", localeTag: "pt-PT", nativeName: "Português (Portugal)", googleTo: "pt" },
  { code: "pa", localeTag: "pa-IN", nativeName: "ਪੰਜਾਬੀ", googleTo: "pa" },
  { code: "ro", localeTag: "ro-RO", nativeName: "Română", googleTo: "ro" },
  { code: "ru", localeTag: "ru-RU", nativeName: "Русский", googleTo: "ru" },
  { code: "sk", localeTag: "sk-SK", nativeName: "Slovenčina", googleTo: "sk" },
  { code: "sl", localeTag: "sl-SI", nativeName: "Slovenščina", googleTo: "sl" },
  { code: "es", localeTag: "es-ES", nativeName: "Español", googleTo: "es" },
  { code: "sv", localeTag: "sv-SE", nativeName: "Svenska", googleTo: "sv" },
  { code: "ta", localeTag: "ta-IN", nativeName: "தமிழ்", googleTo: "ta" },
  { code: "te", localeTag: "te-IN", nativeName: "తెలుగు", googleTo: "te" },
  { code: "th", localeTag: "th-TH", nativeName: "ไทย", googleTo: "th" },
  { code: "tr", localeTag: "tr-TR", nativeName: "Türkçe", googleTo: "tr" },
  { code: "uk", localeTag: "uk-UA", nativeName: "Українська", googleTo: "uk" },
  { code: "ur", localeTag: "ur-PK", nativeName: "اردو", googleTo: "ur" },
  { code: "vi", localeTag: "vi-VN", nativeName: "Tiếng Việt", googleTo: "vi" },
];

/** When the phone only reports a bare code, map it onto a registered catalog entry. */
export const DEVICE_LANGUAGE_ALIASES = {
  pt: "pt-BR",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  nn: "nb",
  no: "nb",
};
