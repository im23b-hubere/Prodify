import { perWeekLabel, weeklySavingPercent } from "../../../features/paywall/paywallPricing";

const weekly = {
  price: 9.99,
  priceString: "$9.99",
  pricePerWeek: 9.99,
  pricePerWeekString: "$9.99",
};
const sixMonths = {
  price: 59.99,
  priceString: "$59.99",
  pricePerWeek: 2.31,
  pricePerWeekString: "$2.31",
};

describe("perWeekLabel", () => {
  it("uses the store's own per-week price", () => {
    expect(perWeekLabel(sixMonths)).toEqual({ amount: "$2.31", isPerWeek: true });
  });

  it("falls back to the full price when the store sends no weekly rate", () => {
    expect(perWeekLabel({ ...sixMonths, pricePerWeek: null, pricePerWeekString: null })).toEqual({
      amount: "$59.99",
      isPerWeek: false,
    });
  });
});

describe("weeklySavingPercent", () => {
  it("compares the long plan's weekly rate with paying weekly", () => {
    expect(weeklySavingPercent(weekly, sixMonths)).toBe(77);
  });

  it("is unknown without both rates or when nothing is saved", () => {
    expect(weeklySavingPercent(undefined, sixMonths)).toBeNull();
    expect(weeklySavingPercent(weekly, { ...sixMonths, pricePerWeek: null })).toBeNull();
    expect(weeklySavingPercent(weekly, { ...sixMonths, pricePerWeek: 12 })).toBeNull();
  });
});
