import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TFunction } from "i18next";

import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

type Dependencies = {
  closeSetupModal: (after?: () => void) => void;
  openSetupScreen: () => void;
  refreshDashboard: (options: { force?: boolean; withLoading?: boolean }) => Promise<unknown>;
  setActive: Dispatch<SetStateAction<SessionDto | null>>;
  setSessions: Dispatch<SetStateAction<SessionDto[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  t: TFunction;
};

export function useDashboardSessionSetupResults({
  closeSetupModal,
  openSetupScreen,
  refreshDashboard,
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
      void refreshDashboard({ force: true });
    });
  }, [closeSetupModal, refreshDashboard]);

  const handleSessionStarted = useCallback(
    (created: unknown) => {
      const session = tryParseSessionDto(created);
      if (!session) {
        setError(t("dashboard.couldNotReadSession"));
        closeSetupModal(() => void refreshDashboard({ force: true }));
        return;
      }

      setActive(session);
      setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)]);
      closeSetupModal(() => {
        void refreshDashboard({ force: true }).catch(() => undefined);
      });
    },
    [closeSetupModal, refreshDashboard, setActive, setError, setSessions, t],
  );

  return { recoverFromCrash, resolveActiveSessionConflict, handleSessionStarted };
}
