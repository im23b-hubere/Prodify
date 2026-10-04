import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadCelebratedFullWeek,
  saveCelebratedFullWeek,
} from "../../../features/stats/fullWeekCelebrated";

describe("full week celebration storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads a stored Monday per user and ignores junk", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("2026-01-05");
    await expect(loadCelebratedFullWeek(4)).resolves.toBe("2026-01-05");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("prodify_full_week_celebrated_v1_4");

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("nope");
    await expect(loadCelebratedFullWeek(4)).resolves.toBeNull();
  });

  it("remembers the celebrated week for that user", async () => {
    await saveCelebratedFullWeek(4, "2026-01-05");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "prodify_full_week_celebrated_v1_4",
      "2026-01-05",
    );
  });
});
