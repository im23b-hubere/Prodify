import type { TFunction } from "i18next";

import type { DuelRecordDto } from "../../../types/friends";

/** Short "3–1" score plus a spoken version for screen readers. */
export function duelRecordLabel(t: TFunction, record: DuelRecordDto) {
  const counts = { wins: record.wins, losses: record.losses, ties: record.ties };
  return {
    short: t(record.ties > 0 ? "duelBoard.recordWithTies" : "duelBoard.record", counts),
    spoken: t("duelBoard.recordA11y", counts),
    isWinning: record.wins > record.losses,
  };
}
