import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TFunction } from "i18next";

import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

type Dependencies = {
  closeSetupModal: (after?: () => void) => void;
  openSetupScreen: () => void;
  loadSessions: () => Promise<void>;
  loadStreakOverview: () => Promise<void>;
  setActive: Dispatch<SetStateAction<SessionDto | null>>;
  setSessions: Dispatch<SetStateAction<SessionDto[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  t: TFunction;
};

export function useDashboardSessionSetupResults({
  closeSetupModal,
  openSetupScreen,
  loadSessions,
  loadStreakOverview,
  setActive,
  setSessions,
  setError,
  t,
}: Dependencies) {
  const recoverFromCrash = useCallback(
    () => closeSetupModal(openSetupScreen),
    [closeSetupModal, openSetupScreen],
  );

  const resolveActiveSessionConflict = useCallback(() => {
    closeSetupModal(() => {
      void loadSessions();
      void loadStreakOverview();
    });
  }, [closeSetupModal, loadSessions, loadStreakOverview]);

  const handleSessionStarted = useCallback(
    (created: unknown) => {
      const session = tryParseSessionDto(created);
      if (!session) {
        setError(t("dashboard.couldNotReadSession"));
        closeSetupModal(() => void loadSessions());
        return;
      }

      setActive(session);
      setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)]);
      closeSetupModal(() => {
        void Promise.all([
          loadSessions().catch(() => undefined),
          loadStreakOverview().catch(() => undefined),
        ]);
      });
    },
    [closeSetupModal, loadSessions, loadStreakOverview, setActive, setError, setSessions, t],
  );

  return { recoverFromCrash, resolveActiveSessionConflict, handleSessionStarted };
}
