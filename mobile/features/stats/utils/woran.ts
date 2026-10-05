import type { TFunction } from "i18next";

import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatAvgSessionLength } from "./format";

export type WoranRow = {
  branch: string;
  label: string;
  hoursLabel: string;
  seconds: number;
  share: number;
};

export function buildWoranRows(
  branchSeconds: { branch: string; seconds: number }[] | undefined,
  t: TFunction,
): WoranRow[] {
  const counted = (branchSeconds ?? []).filter((item) => item.seconds > 0);
  const total = counted.reduce((sum, item) => sum + item.seconds, 0);
  return counted.map((item) => ({
    branch: item.branch,
    label: sessionTypeLabel(item.branch, t),
    hoursLabel: formatAvgSessionLength(item.seconds),
    seconds: item.seconds,
    share: total > 0 ? item.seconds / total : 0,
  }));
}
