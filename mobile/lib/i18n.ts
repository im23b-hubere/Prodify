import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../locales/de.json";
import en from "../locales/en.json";

const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

const supported = new Set(["de", "en"]);
const deviceCode = Localization.getLocales()[0]?.languageCode ?? "de";
const lng = supported.has(deviceCode) ? deviceCode : "de";

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: "de",
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

export default i18n;
