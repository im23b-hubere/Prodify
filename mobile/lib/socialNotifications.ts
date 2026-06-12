import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

let socialChannelReady = false;
const SOCIAL_PUSH_THROTTLE_KEY = "prodify_social_push_throttle_v1";

async function ensureSocialChannel() {
  if (Platform.OS !== "android" || socialChannelReady) return;
  socialChannelReady = true;
  await Notifications.setNotificationChannelAsync("social", {
    name: "Social updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 80, 180],
    lightColor: "#A259FF",
  });
}

async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

type PushThrottleState = Record<string, number>;

async function loadThrottleState(): Promise<PushThrottleState> {
  try {
    const raw = await AsyncStorage.getItem(SOCIAL_PUSH_THROTTLE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PushThrottleState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveThrottleState(state: PushThrottleState) {
  try {
    await AsyncStorage.setItem(SOCIAL_PUSH_THROTTLE_KEY, JSON.stringify(state));
  } catch {
    /* ignore write failures */
  }
}

async function shouldSkipByThrottle(throttleKey?: string, throttleMs = 0): Promise<boolean> {
  if (!throttleKey || throttleMs <= 0) return false;
  const now = Date.now();
  const state = await loadThrottleState();
  const last = state[throttleKey];
  if (typeof last === "number" && now - last < throttleMs) {
    return true;
  }
  return false;
}

async function markThrottleSent(throttleKey?: string): Promise<void> {
  if (!throttleKey) return;
  const state = await loadThrottleState();
  state[throttleKey] = Date.now();
  await saveThrottleState(state);
}

export async function sendLocalSocialNotification(input: {
  title: string;
  body: string;
  path: string;
  throttleKey?: string;
  throttleMs?: number;
}) {
  const skip = await shouldSkipByThrottle(input.throttleKey, input.throttleMs ?? 0);
  if (skip) return;
  await ensureSocialChannel();
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      data: { kind: "social", path: input.path },
      ...(Platform.OS === "android" ? { channelId: "social" } : {}),
    },
    trigger: null,
  });
  await markThrottleSent(input.throttleKey);
}
