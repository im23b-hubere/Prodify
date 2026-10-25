import {
  weeklyEquivalentPrice,
  weeklySavingPercent,
} from "../../../features/paywall/paywallPricing";

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

describe("weeklyEquivalentPrice", () => {
  it("offers the store's weekly rate as a comparison for a longer plan", () => {
    expect(weeklyEquivalentPrice(sixMonths)).toBe("$2.31");
  });

  it("is null when the weekly rate would only repeat the billed price", () => {
    expect(weeklyEquivalentPrice(weekly)).toBeNull();
  });

  it("is null when the store sends no weekly rate", () => {
    expect(weeklyEquivalentPrice({ ...sixMonths, pricePerWeekString: null })).toBeNull();
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
