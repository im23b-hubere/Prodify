import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

import { PrimaryButton } from "../components/ui/PrimaryButton";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("PrimaryButton", () => {
  test("renders label and calls onPress", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Continue" onPress={onPress} />);

    expect(screen.getByText("Continue")).toBeTruthy();
    fireEvent.press(screen.getByText("Continue"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("shows a spinner while loading and does not show the label", () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(<PrimaryButton label="Save" onPress={onPress} loading />);

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText("Save")).toBeNull();
  });
});
