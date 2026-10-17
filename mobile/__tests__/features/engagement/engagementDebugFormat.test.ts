import type { TFunction } from "i18next";

import { formatWindow } from "../../../features/engagement/engagementDebugFormat";

const t = ((key: string) => (key === "engagementDebug.everyDay" ? "Every day" : key)) as TFunction;

describe("engagementDebugFormat", () => {
  it("localizes the all-weekdays label through t()", () => {
    expect(
      formatWindow(
        {
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          start_hour: 10,
          end_hour: 22,
          is_default: false,
        },
        t,
      ),
    ).toBe("Every day 10:00–22:00");
  });
});
