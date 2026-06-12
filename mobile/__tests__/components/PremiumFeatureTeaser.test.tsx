import { fireEvent, render, screen } from "@testing-library/react-native";

import { PremiumFeatureTeaser } from "../../components/premium/PremiumFeatureTeaser";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("PremiumFeatureTeaser", () => {
  it("renders copy and calls onPress", () => {
    const onPress = jest.fn();
    render(
      <PremiumFeatureTeaser
        title="Premium title"
        body="Premium body"
        ctaLabel="See Premium"
        onPress={onPress}
      />,
    );

    expect(screen.getByText("Premium title")).toBeTruthy();
    expect(screen.getByText("Premium body")).toBeTruthy();
    fireEvent.press(screen.getByText("See Premium"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
