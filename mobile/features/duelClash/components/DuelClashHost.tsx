import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { dismissCurrentDuelClash, useCurrentDuelClash } from "../duelClashStore";
import { useAcceptedDuelWatcher } from "../hooks/useAcceptedDuelWatcher";
import { DuelClashOverlay } from "./DuelClashOverlay";

/** App-wide mount point: shows one clash at a time, whichever side triggered it. */
export function DuelClashHost() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const clash = useCurrentDuelClash();
  useAcceptedDuelWatcher(token, user?.id, t("friendsScreen.buddyDuelYouLabel"));
  if (!clash) return null;
  return <DuelClashOverlay key={clash.challengeId} clash={clash} onFinished={dismissCurrentDuelClash} />;
}
