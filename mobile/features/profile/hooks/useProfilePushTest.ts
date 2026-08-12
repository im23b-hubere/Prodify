import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { ApiError, apiJson } from "../../../lib/client";

export type PushTestTemplate = "test" | "session_demo" | "streak_demo";

export function useProfilePushTest(token?: string | null) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<PushTestTemplate>("test");

  const selectTemplate = useCallback((nextTemplate: PushTestTemplate) => {
    Haptics.selectionAsync().catch(() => undefined);
    setTemplate(nextTemplate);
  }, []);

  const send = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      const body =
        template === "test"
          ? {
              template: "test" as const,
              title: t("profile.pingTestTitle"),
              body: t("profile.pingTestBody"),
            }
          : template === "session_demo"
            ? { template: "session_demo" as const }
            : { template: "streak_demo" as const, streak_days: 12 };
      const result = await apiJson<{
        attempted: number;
        delivered_ok: number;
        message?: string | null;
      }>("/notifications/ping-self", { token, method: "POST", body });
      const delivery = t("profile.pingDelivered", {
        ok: result.delivered_ok,
        attempted: result.attempted,
      });
      Alert.alert(
        t("profile.pingResultTitle"),
        `${delivery}${result.message ? `\n${result.message}` : ""}`,
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      Alert.alert(t("profile.pingResultTitle"), message);
    } finally {
      setBusy(false);
    }
  }, [t, template, token]);

  return { busy, template, selectTemplate, send };
}
