import { render, within } from "@testing-library/react-native";
import { Modal } from "react-native";

import { colors } from "../../../constants/theme";
import { DurationWheelSheet } from "../../../features/sessions/components/DurationWheelSheet";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

function renderWheel() {
  return render(
    <DurationWheelSheet
      visible
      title="EQ"
      totalMinutes={46}
      maxMinutes={92}
      onChange={jest.fn()}
      onSave={jest.fn()}
      onCancel={jest.fn()}
    />,
  );
}

describe("DurationWheelSheet", () => {
  it("slides up from the bottom and occupies half the screen", () => {
    const { getByTestId, UNSAFE_getByType } = renderWheel();

    expect(UNSAFE_getByType(Modal).props.animationType).toBe("slide");
    expect(getByTestId("duration-wheel")).toHaveStyle({ height: "50%" });
  });

  it("paints Cancel and Save in Prodify orange", () => {
    const { getByTestId } = renderWheel();

    expect(within(getByTestId("duration-wheel-cancel")).getByText("Cancel")).toHaveStyle({
      color: colors.primary,
    });
    expect(within(getByTestId("duration-wheel-save")).getByText("Save")).toHaveStyle({
      color: colors.primary,
    });
  });
});
