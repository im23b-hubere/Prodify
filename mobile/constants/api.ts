/**
 * Set EXPO_PUBLIC_API_URL for physical devices (e.g. http://192.168.1.x:8000).
 * iOS Simulator: 127.0.0.1 works. Android emulator: use http://10.0.2.2:8000
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
