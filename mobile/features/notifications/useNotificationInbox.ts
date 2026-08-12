import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import {
  loadInbox,
  loadSettings,
  markAllRead,
  markServerInboxRead,
  removeItem,
  saveSettings,
  syncServerInbox,
  type InboxItem,
  type NotificationCategory,
  type NotificationSettings,
} from "../../lib/notificationInbox";
import { syncWeeklyRecapReminder } from "../../lib/weeklyRecapNotifications";
import { filterNotifications, latestNotificationTimestamp } from "./notificationPresentation";

export function useNotificationInbox() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const errors: string[] = [];
    if (token) {
      try {
        await syncServerInbox(token, 60);
      } catch (syncError) {
        errors.push(
          syncError instanceof Error ? syncError.message : t("notificationsUi.syncFailed"),
        );
      }
    }
    const [inbox, loadedSettings] = await Promise.all([loadInbox(), loadSettings()]);
    setItems(inbox);
    setSettings(loadedSettings);
    await markAllRead();
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    if (token) {
      try {
        await markServerInboxRead(token, latestNotificationTimestamp(inbox, Date.now()));
      } catch (readError) {
        errors.push(
          readError instanceof Error ? readError.message : t("notificationsUi.readSyncFailed"),
        );
      }
    }
    setServerSyncError(errors.length ? errors.join("\n") : null);
    setInitialLoading(false);
  }, [t, token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await load().catch(() => undefined);
    setRefreshing(false);
  }, [load]);

  const updateSetting = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      if (!settings) return;
      const updated = { ...settings, ...patch };
      setSettings(updated);
      await saveSettings(updated);
      if ("tips" in patch || "frequency" in patch) {
        void syncWeeklyRecapReminder(Boolean(token) && updated.tips && updated.frequency !== "off");
      }
      Haptics.selectionAsync().catch(() => undefined);
    },
    [settings, token],
  );

  const remove = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      await removeItem(id);
      await load();
    },
    [load],
  );

  return {
    token,
    items: useMemo(() => filterNotifications(items, filter), [filter, items]),
    settings,
    initialLoading,
    refreshing,
    filter,
    setFilter,
    serverSyncError,
    load,
    refresh,
    updateSetting,
    remove,
  };
}
