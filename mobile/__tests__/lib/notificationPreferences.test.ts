import {
  DEFAULT_QUIET_HOURS,
  preferencesFromLegacySettings,
  withServerPreferences,
  type NotificationPreferences,
} from "../../lib/notificationPreferences";
import type { NotificationSettings } from "../../lib/notificationTypes";

const legacy: NotificationSettings = {
  streak: true,
  achievements: true,
  social: true,
  tips: true,
  quietStartMinute: 0,
  quietEndMinute: 0,
  frequency: "all",
};

const serverDefaults: NotificationPreferences = {
  smart_enabled: true,
  streak: true,
  social: true,
  challenge: true,
  rank: true,
  reengagement: true,
  quiet_start_minute: 22 * 60 + 30,
  quiet_end_minute: 8 * 60,
};

describe("preferencesFromLegacySettings", () => {
  it("keeps the server's default quiet hours when the device never had them on", () => {
    expect(preferencesFromLegacySettings(legacy)).toEqual(serverDefaults);
  });

  it("carries over the categories a producer turned off on this device", () => {
    const prefs = preferencesFromLegacySettings({ ...legacy, streak: false, social: false, tips: false });

    expect(prefs).toMatchObject({
      streak: false,
      social: false,
      challenge: false,
      rank: false,
      reengagement: false,
    });
  });

  it("carries over quiet hours the producer had switched on", () => {
    const prefs = preferencesFromLegacySettings({
      ...legacy,
      quietStartMinute: 23 * 60,
      quietEndMinute: 7 * 60,
    });

    expect(prefs).toMatchObject({ quiet_start_minute: 23 * 60, quiet_end_minute: 7 * 60 });
  });

  it("turns smart notifications off for producers who had notifications off", () => {
    expect(preferencesFromLegacySettings({ ...legacy, frequency: "off" }).smart_enabled).toBe(false);
  });
});

describe("withServerPreferences", () => {
  it("mirrors the server's streak, social and quiet hours into the device inbox filter", () => {
    const local = withServerPreferences(legacy, {
      ...serverDefaults,
      streak: false,
      social: false,
    });

    expect(local).toEqual({
      ...legacy,
      streak: false,
      social: false,
      quietStartMinute: DEFAULT_QUIET_HOURS.start,
      quietEndMinute: DEFAULT_QUIET_HOURS.end,
    });
  });

  it("leaves device-only settings alone", () => {
    const local = withServerPreferences(
      { ...legacy, achievements: false, tips: false, frequency: "important" },
      serverDefaults,
    );

    expect(local).toMatchObject({ achievements: false, tips: false, frequency: "important" });
  });
});
