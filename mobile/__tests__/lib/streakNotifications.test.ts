import { streakReminderPlan } from "../../lib/streakNotifications";

const sixPm = new Date(2026, 7, 12, 18, 0);

describe("streakReminderPlan", () => {
  it("plans the three local evening reminders when the server cannot push to this device", () => {
    const plan = streakReminderPlan({ atRisk: true, streakCount: 5, serverCanPush: false, now: sixPm });

    expect(plan.map((reminder) => [reminder.fireAt.getHours(), reminder.fireAt.getMinutes()])).toEqual([
      [22, 0],
      [23, 0],
      [23, 30],
    ]);
  });

  it("leaves streak reminders to the server once a push token is registered", () => {
    const plan = streakReminderPlan({ atRisk: true, streakCount: 5, serverCanPush: true, now: sixPm });

    expect(plan).toEqual([]);
  });

  it("skips reminders whose time has already passed today", () => {
    const lateEvening = new Date(2026, 7, 12, 23, 10);

    const plan = streakReminderPlan({ atRisk: true, streakCount: 5, serverCanPush: false, now: lateEvening });

    expect(plan).toHaveLength(1);
  });

  it("plans nothing when the streak is safe", () => {
    expect(streakReminderPlan({ atRisk: false, streakCount: 5, serverCanPush: false, now: sixPm })).toEqual([]);
  });
});
