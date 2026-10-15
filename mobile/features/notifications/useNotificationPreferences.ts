import { useCallback, useEffect, useRef, useState } from "react";

import { hasSavedSettings, loadSettings, saveSettings } from "../../lib/notificationInbox";
import {
  fetchNotificationPreferences,
  preferencesFromLegacySettings,
  saveNotificationPreferences,
  withServerPreferences,
  type NotificationPreferences,
  type NotificationPreferencesResponse,
} from "../../lib/notificationPreferences";

type LoadStatus = "idle" | "loading" | "ready" | "error";

function stripResponse({ customized: _customized, ...prefs }: NotificationPreferencesResponse) {
  return prefs;
}

async function mirrorIntoInboxFilter(prefs: NotificationPreferences): Promise<void> {
  await saveSettings(withServerPreferences(await loadSettings(), prefs));
}

/** Accounts created before preferences lived on the server get their device settings once. */
async function loadWithLegacyUpload(token: string): Promise<NotificationPreferences> {
  const response = await fetchNotificationPreferences(token);
  if (response.customized || !(await hasSavedSettings())) return stripResponse(response);
  const legacy = preferencesFromLegacySettings(await loadSettings());
  return stripResponse(await saveNotificationPreferences(token, legacy));
}

/**
 * The producer's server-side notification preferences. Changes apply at once and roll back
 * if the server rejects them.
 */
export function useNotificationPreferences(token: string | null | undefined) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadStatus, setStatus] = useState<Exclude<LoadStatus, "idle">>("loading");
  const status: LoadStatus = token ? loadStatus : "idle";
  const [saveFailed, setSaveFailed] = useState(false);
  const confirmed = useRef<NotificationPreferences | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback((): Promise<void> => {
    const sequence = ++loadSequence.current;
    if (!token) return Promise.resolve();
    return loadWithLegacyUpload(token).then(
      (loaded) => {
        if (sequence !== loadSequence.current) return;
        confirmed.current = loaded;
        setPreferences(loaded);
        setStatus("ready");
        return mirrorIntoInboxFilter(loaded).catch(() => undefined);
      },
      () => {
        if (sequence === loadSequence.current) setStatus("error");
      },
    );
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(async () => {
    setStatus("loading");
    await load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      const previous = confirmed.current;
      if (!token || !previous) return;
      const next = { ...previous, ...patch };
      confirmed.current = next;
      setPreferences(next);
      setSaveFailed(false);
      try {
        const saved = stripResponse(await saveNotificationPreferences(token, next));
        confirmed.current = saved;
        setPreferences(saved);
        await mirrorIntoInboxFilter(saved);
      } catch {
        confirmed.current = previous;
        setPreferences(previous);
        setSaveFailed(true);
      }
    },
    [token],
  );

  return { preferences, status, saveFailed, update, retry };
}

export type NotificationPreferencesState = ReturnType<typeof useNotificationPreferences>;
