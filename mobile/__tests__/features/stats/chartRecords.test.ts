import { chartRecordCaption, chartRecordMarks } from "../../../features/stats/utils/chartRecords";
import type { BarPoint, DecoratedRecord } from "../../../features/stats/types";
import { mockTFunction } from "../../helpers/mockTFunction";

const t = mockTFunction();

function bar(label: string, y = 1): BarPoint {
  return { x: label.slice(-2), y, label };
}

function record(overrides: Partial<DecoratedRecord>): DecoratedRecord {
  return {
    key: "most_hours_day",
    label: "Most hours in one day",
    value: "2h 0m",
    context: "2026-01-07",
    occurred_at: "2026-01-07",
    score: 70,
    isFresh: false,
    ...overrides,
  };
}

describe("chartRecordMarks", () => {
  const weekBars = [bar("2026-01-05"), bar("2026-01-07"), bar("2026-01-08")];

  it("pins the hours-day best onto that day's bar", () => {
    expect(
      chartRecordMarks(weekBars, [record({ key: "most_hours_day", occurred_at: "2026-01-07" })], "week"),
    ).toEqual([
      {
        barLabel: "2026-01-07",
        record: expect.objectContaining({ key: "most_hours_day" }),
      },
    ]);
  });

  it("still marks the old session-count key so current production records keep working", () => {
    const marks = chartRecordMarks(
      weekBars,
      [record({ key: "most_sessions_day", occurred_at: "2026-01-05" })],
      "week",
    );
    expect(marks.map((mark) => mark.barLabel)).toEqual(["2026-01-05"]);
  });

  it("keeps longest session on its day, but hours-day wins when both land on the same bar", () => {
    const longest = record({
      key: "longest_session",
      occurred_at: "2026-01-07",
      value: "90 min",
    });
    const hoursDay = record({ key: "most_hours_day", occurred_at: "2026-01-07" });

    expect(chartRecordMarks(weekBars, [longest], "week")[0]?.record.key).toBe("longest_session");
    expect(chartRecordMarks(weekBars, [longest, hoursDay], "week")[0]?.record.key).toBe("most_hours_day");
  });

  it("does not put a productive week or a streak onto daily bars", () => {
    expect(
      chartRecordMarks(
        weekBars,
        [
          record({ key: "productive_week", occurred_at: "2026-01-05" }),
          record({ key: "longest_streak", occurred_at: null }),
        ],
        "week",
      ),
    ).toEqual([]);
  });

  it("skips records whose day is outside the visible chart", () => {
    expect(
      chartRecordMarks(weekBars, [record({ occurred_at: "2025-12-01" })], "month"),
    ).toEqual([]);
  });

  it("folds a day best into that week's Monday on the lifetime chart", () => {
    const marks = chartRecordMarks(
      [bar("2026-01-05"), bar("2026-01-12")],
      [record({ key: "longest_session", occurred_at: "2026-01-07" })],
      "all",
    );
    expect(marks.map((mark) => mark.barLabel)).toEqual(["2026-01-05"]);
  });

  it("pins the productive week onto its week-start bar on the lifetime chart", () => {
    const marks = chartRecordMarks(
      [bar("2026-01-05"), bar("2026-01-12")],
      [record({ key: "productive_week", occurred_at: "2026-01-12", value: "8h 0m total" })],
      "all",
    );
    expect(marks[0]?.barLabel).toBe("2026-01-12");
    expect(marks[0]?.record.key).toBe("productive_week");
  });

  it("prefers the productive week over a day best when both map to the same lifetime bar", () => {
    const marks = chartRecordMarks(
      [bar("2026-01-05")],
      [
        record({ key: "most_hours_day", occurred_at: "2026-01-07" }),
        record({ key: "productive_week", occurred_at: "2026-01-05" }),
      ],
      "all",
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.record.key).toBe("productive_week");
  });

  it("reads a datetime occurred_at as its calendar day", () => {
    const marks = chartRecordMarks(
      weekBars,
      [record({ occurred_at: "2026-01-08T22:15:00Z" })],
      "week",
    );
    expect(marks.map((mark) => mark.barLabel)).toEqual(["2026-01-08"]);
  });
});

describe("chartRecordCaption", () => {
  it("names the hours-day best with its value", () => {
    expect(chartRecordCaption(record({ key: "most_hours_day", value: "2h 0m" }), t)).toBe(
      "stats.recordMostHoursDay · 2h 0m",
    );
  });
});
