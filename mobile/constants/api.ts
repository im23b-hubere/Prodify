import { Platform } from "react-native";

/**
 * Override with EXPO_PUBLIC_API_URL when needed:
 * - Physical device (LAN): http://192.168.x.x:8000
 * - Android emulator: http://10.0.2.2:8000
 * - iOS simulator/web/local dev: http://127.0.0.1:8000
 */
const defaultApiUrl = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;
