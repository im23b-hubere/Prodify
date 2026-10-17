import type { TFunction } from "i18next";

import { activityRows, durationLabel } from "../../../features/sessions/share/data";
import type { SessionData } from "../../../features/sessions/share/types";

const t = ((key: string, options?: { count?: number; h?: number; m?: number }) => {
  if (key === "shareCard.durationSeconds") return `${options?.count}s`;
  if (key === "shareCard.durationMinutes") return `${options?.count}m`;
  if (key === "shareCard.durationHoursMinutes") return `${options?.h}h ${options?.m}m`;
  if (key === "shareCard.activityProduction") return "Production";
  if (key === "shareCard.activityOther") return "Other";
  return key;
}) as TFunction;

describe("share card data i18n", () => {
  it("formats short durations through t()", () => {
    expect(durationLabel(45, t)).toBe("45s");
    expect(durationLabel(300, t)).toBe("5m");
    expect(durationLabel(3660, t)).toBe("1h 1m");
  });

  it("fills leftover time with localized Production/Other labels", () => {
    const session: SessionData = {
      id: "1",
      producerName: "erix",
      dateLabel: "07 OCT 2026",
      durationSeconds: 600,
      activities: [{ label: "Drums", durationSeconds: 300 }],
    };
    const rows = activityRows(session, t);
    expect(rows).toEqual([
      { label: "Drums", durationSeconds: 300 },
      { label: "Other", durationSeconds: 300 },
    ]);
  });
});
