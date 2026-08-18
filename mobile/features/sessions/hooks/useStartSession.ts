import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { SessionType } from "../../../constants/sessionTypes";
import { ApiError, apiJson } from "../../../lib/client";
import { debugLog } from "../../../lib/debugLog";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

const SUBMIT_COOLDOWN_MS = 800;
type Args = {
  token?: string | null;
  hydrated: boolean;
  selectedType: SessionType | null;
  notes: string;
  mood: number | null;
  tags: string[];
  t: TFunction;
  onStarted: (session: SessionDto) => void;
  onConflict?: (id?: number) => void;
};

export function useStartSession(args: Args) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useSubmitGuard();
  const submit = useCallback(async () => {
    const token = args.token?.trim();
    if (!args.hydrated || !token || !args.selectedType || busy || guard.inFlight.current) {
      if (args.hydrated && !token) setError(args.t("sessionSetup.notSignedIn"));
      return;
    }
    guard.inFlight.current = true;
    if (guard.mounted.current) {
      setBusy(true);
      setError(null);
    }
    debugLog("session", "start_attempt", {
      hasNotes: Boolean(args.notes.trim()),
      moodLevel: args.mood,
      tagCount: args.tags.length,
    });
    try {
      const session = await requestSession(token, args);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      debugLog("session", "start_success", { sessionId: session.id });
      if (guard.mounted.current) await Promise.resolve(args.onStarted(session));
    } catch (cause) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const message = cause instanceof Error ? cause.message : args.t("sessionSetup.startFailed");
      debugLog("session", "start_failure", {
        status: cause instanceof ApiError ? cause.status : 0,
        message,
      });
      const resumed =
        cause instanceof ApiError && cause.status === 409
          ? await resolveConflict(cause, token, args)
          : false;
      if (guard.mounted.current && !resumed)
        setError(
          cause instanceof ApiError && cause.status === 409
            ? args.t("sessionSetup.activeSessionError")
            : message,
        );
    } finally {
      if (guard.cooldown.current) clearTimeout(guard.cooldown.current);
      guard.cooldown.current = setTimeout(() => {
        guard.inFlight.current = false;
      }, SUBMIT_COOLDOWN_MS);
      if (guard.mounted.current) setBusy(false);
    }
  }, [args, busy, guard]);
  return { busy, error, submit };
}

function useSubmitGuard() {
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      mounted.current = false;
      if (cooldown.current) clearTimeout(cooldown.current);
    },
    [],
  );
  return { mounted, inFlight, cooldown };
}

async function requestSession(token: string, args: Args): Promise<SessionDto> {
  const raw = await apiJson<unknown>("/sessions/start", {
    token,
    method: "POST",
    body: {
      session_type: args.selectedType,
      notes: args.notes.trim() ? args.notes.trim().slice(0, 200) : undefined,
      mood_level: args.mood ?? undefined,
      tags: args.tags.length ? args.tags : undefined,
    },
  });
  const session = tryParseSessionDto(raw);
  if (!session) {
    debugLog("session", "start_invalid_dto", {});
    throw new Error(`Invalid response DTO: ${JSON.stringify(raw)}`);
  }
  return session;
}

async function resolveConflict(error: ApiError, token: string, args: Args): Promise<boolean> {
  const payload = error.payload as {
    detail?: { session_id?: unknown };
    session_id?: unknown;
  } | null;
  const candidate = payload?.session_id ?? payload?.detail?.session_id;
  const id =
    typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  if (!id) {
    args.onConflict?.();
    return false;
  }
  try {
    const session = tryParseSessionDto(await apiJson<unknown>(`/sessions/item/${id}`, { token }));
    if (session) {
      Alert.alert(
        args.t("sessionSetup.activeSessionTitle"),
        args.t("sessionSetup.activeSessionBody"),
        [{ text: args.t("common.continue") }],
      );
      args.onStarted(session);
      args.onConflict?.(id);
      return true;
    }
  } catch {
    /* Parent still refreshes using the known id. */
  }
  args.onConflict?.(id);
  return false;
}
