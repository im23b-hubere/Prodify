import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { REMINDER_PROMPT_ANSWERED_KEY } from "../../constants/storageKeys";
import { useNotificationPermission } from "./useNotificationPermission";

/**
 * The card that invites a producer to turn reminders on. It explains the value before the
 * one-time system prompt, appears only while the OS has not asked yet, and never again once
 * answered either way.
 */
export function useReminderPrompt() {
  const permission = useNotificationPermission();
  const { request } = permission;
  const [answered, setAnswered] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(REMINDER_PROMPT_ANSWERED_KEY)
      .then((value) => !cancelled && setAnswered(value === "1"))
      .catch(() => !cancelled && setAnswered(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const markAnswered = useCallback(async () => {
    setAnswered(true);
    await AsyncStorage.setItem(REMINDER_PROMPT_ANSWERED_KEY, "1").catch(() => undefined);
  }, []);

  const accept = useCallback(async () => {
    await markAnswered();
    await request();
  }, [markAnswered, request]);

  return {
    visible: permission.status === "undetermined" && answered === false,
    settled: permission.settled && answered !== null,
    accept,
    dismiss: markAnswered,
  };
}
