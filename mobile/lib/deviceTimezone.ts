import * as Localization from "expo-localization";

import { apiJson } from "./client";

/** The device's IANA identifier (e.g. "Europe/Berlin"), or null if the platform reports none. */
export function readDeviceTimezone(): string | null {
  const timeZone = Localization.getCalendars()[0]?.timeZone;
  return timeZone && timeZone.length > 0 ? timeZone : null;
}

/**
 * Tell the backend which timezone to resolve calendar days in.
 *
 * Streaks, check-ins and weekly goals all roll over at the user's local midnight, which the
 * server can only know if the device reports it. Rejects are swallowed by the caller.
 */
export async function reportDeviceTimezone(token: string, timezone: string): Promise<void> {
  await apiJson("/users/me/timezone", {
    method: "PUT",
    token,
    body: { timezone },
  });
}
