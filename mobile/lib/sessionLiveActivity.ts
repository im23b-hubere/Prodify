import type { SessionDto } from "../types/session";
import i18n from "./i18n";
import { sessionTypeLabel } from "./sessionI18n";
import {
  buildSessionActivityProps,
  type SessionActivityCopy,
  type SessionActivityProps,
} from "./sessionLiveActivityProps";
import { canUseWidgetExtension } from "./widgetExtension";

type SessionActivityModule = typeof import("../widgets/SessionActivity");
type SessionActivityFactory = SessionActivityModule["default"];
type SessionLiveActivity = ReturnType<SessionActivityFactory["getInstances"]>[number];

const ACTIVE_SESSION_URL = "prodify://session/active";

let factory: SessionActivityFactory | null | undefined;
let lastShownPropsKey: string | null = null;

/**
 * Mirrors the running session on the Lock Screen and in the Dynamic Island, or ends the Live
 * Activity when `session` is null. Idempotent, so every place that learns the current session
 * can call it. Best effort: the user may have turned Live Activities off.
 */
export function syncSessionLiveActivity(session: SessionDto | null): void {
  const activities = loadFactory();
  if (!activities) return;
  try {
    const props = session ? buildSessionActivityProps(session, sessionActivityCopy()) : null;
    const [current, ...duplicates] = activities.getInstances();
    duplicates.forEach(endNow);

    if (!props) {
      if (current) endNow(current);
      lastShownPropsKey = null;
      return;
    }
    showProps(activities, current, props);
  } catch {
    lastShownPropsKey = null;
  }
}

function showProps(
  activities: SessionActivityFactory,
  current: SessionLiveActivity | undefined,
  props: SessionActivityProps,
) {
  const propsKey = JSON.stringify(props);
  if (!current) {
    activities.start(props, ACTIVE_SESSION_URL);
  } else if (propsKey !== lastShownPropsKey) {
    void current.update(props).catch(() => undefined);
  }
  lastShownPropsKey = propsKey;
}

function endNow(activity: SessionLiveActivity) {
  void activity.end("immediate").catch(() => undefined);
}

function loadFactory(): SessionActivityFactory | null {
  if (factory !== undefined) return factory;
  if (!canUseWidgetExtension()) {
    factory = null;
    return factory;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = (require("../widgets/SessionActivity") as SessionActivityModule).default;
  } catch {
    factory = null;
  }
  return factory;
}

function sessionActivityCopy(): SessionActivityCopy {
  return {
    title: (sessionType) => sessionTypeLabel(sessionType, i18n.t),
    running: i18n.t("sessionLiveActivity.running"),
    paused: i18n.t("sessionLiveActivity.paused"),
  };
}
