import { Linking } from "react-native";

/**
 * The hosted legal pages (the same ones the API reports under /legal/documents). Every link
 * in the app opens these, so the paywall, sign-up and Settings always show the same text.
 */
export const LEGAL_URLS = {
  privacy: "https://klarwerk-tech.ch/prodify/privacy",
  terms: "https://klarwerk-tech.ch/prodify/terms",
  imprint: "https://klarwerk-tech.ch/prodify/impressum",
} as const;

export function openLegalPage(page: keyof typeof LEGAL_URLS) {
  Linking.openURL(LEGAL_URLS[page]).catch(() => undefined);
}
