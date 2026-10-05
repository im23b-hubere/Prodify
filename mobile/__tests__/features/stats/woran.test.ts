import type { TFunction } from "i18next";

import { buildWoranRows } from "../../../features/stats/utils/woran";

const t = ((key: string) => key) as TFunction;

describe("buildWoranRows", () => {
  it("turns period branch seconds into labeled hour rows", () => {
    expect(
      buildWoranRows(
        [
          { branch: "mixing", seconds: 3600 },
          { branch: "beat_making", seconds: 1800 },
        ],
        t,
      ),
    ).toEqual([
      {
        branch: "mixing",
        label: "sessionTypes.mixing",
        hoursLabel: "1h",
        seconds: 3600,
        share: 3600 / 5400,
      },
      {
        branch: "beat_making",
        label: "sessionTypes.beatMaking",
        hoursLabel: "30m",
        seconds: 1800,
        share: 1800 / 5400,
      },
    ]);
  });

  it("returns nothing when the period has no tree hours", () => {
    expect(buildWoranRows([{ branch: "mixing", seconds: 0 }], t)).toEqual([]);
    expect(buildWoranRows(undefined, t)).toEqual([]);
  });
});
