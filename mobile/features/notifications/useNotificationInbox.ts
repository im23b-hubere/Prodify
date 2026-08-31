import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import { useAuthScopedReset } from "../../lib/authScopedReset";
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

function useNotificationSettings(token?: string | null) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
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
  return { settings, setSettings, updateSetting };
}

export function useNotificationInbox() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<InboxItem[]>([]);
  const { settings, setSettings, updateSetting } = useNotificationSettings(token);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const mounted = useRef(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSequence.current += 1;
    };
  }, []);

  const resetNotificationAuthScope = useCallback(() => {
    loadSequence.current += 1;
    setItems([]);
    setServerSyncError(null);
    setRefreshing(false);
    setInitialLoading(Boolean(tokenRef.current && userId != null));
  }, [userId]);

  useAuthScopedReset(token ?? null, userId, resetNotificationAuthScope);

  const applyReadState = useCallback(
    async (
      sequence: number,
      inbox: InboxItem[],
      currentToken: string | null | undefined,
      errors: string[],
    ) => {
      await markAllRead();
      if (sequence !== loadSequence.current || !mounted.current) return;

      setItems((current) => current.map((item) => ({ ...item, read: true })));
      if (currentToken && userId != null) {
        try {
          await markServerInboxRead(
            currentToken,
            latestNotificationTimestamp(inbox, Date.now()),
          );
        } catch (readError) {
          if (sequence !== loadSequence.current) return;
          errors.push(
            readError instanceof Error ? readError.message : t("notificationsUi.readSyncFailed"),
          );
        }
      }
      if (sequence !== loadSequence.current || !mounted.current) return;
      setServerSyncError(errors.length ? errors.join("\n") : null);
    },
    [t, userId],
  );

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const currentToken = tokenRef.current;
    const errors: string[] = [];

    const [localInbox, loadedSettings] = await Promise.all([loadInbox(), loadSettings()]);
    if (sequence !== loadSequence.current || !mounted.current) return;

    setSettings(loadedSettings);
    setItems(localInbox);
    setInitialLoading(false);

    if (currentToken && userId != null) {
      try {
        await syncServerInbox(currentToken, 60);
      } catch (syncError) {
        if (sequence !== loadSequence.current) return;
        errors.push(
          syncError instanceof Error ? syncError.message : t("notificationsUi.syncFailed"),
        );
      }
      if (sequence !== loadSequence.current || !mounted.current) return;

      const syncedInbox = await loadInbox();
      if (sequence !== loadSequence.current || !mounted.current) return;

      setItems(syncedInbox);
      await applyReadState(sequence, syncedInbox, currentToken, errors);
      return;
    }

    await applyReadState(sequence, localInbox, currentToken, errors);
  }, [applyReadState, setSettings, t, userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  useEffect(() => {
    if (!tokenRef.current || userId == null) {
      setInitialLoading(false);
      return;
    }
    load().catch(() => undefined);
  }, [load, userId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await load().catch(() => undefined);
    setRefreshing(false);
  }, [load]);

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

export type NotificationInboxState = ReturnType<typeof useNotificationInbox>;
