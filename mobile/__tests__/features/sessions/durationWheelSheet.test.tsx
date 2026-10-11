import { fireEvent, render, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { colors } from "../../../constants/theme";
import { DurationWheelSheet } from "../../../features/sessions/components/DurationWheelSheet";
import { WHEEL_ROW_HEIGHT } from "../../../features/sessions/durationWheel";

jest.mock("react-native-gesture-handler", () => require("../../../test/gestureHandlerStub"));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

function renderWheel(totalMinutes = 46, maxMinutes = 92) {
  const handlers = { onChange: jest.fn(), onSave: jest.fn(), onCancel: jest.fn() };
  const screen = render(
    <DurationWheelSheet
      visible
      title="EQ"
      totalMinutes={totalMinutes}
      maxMinutes={maxMinutes}
      {...handlers}
    />,
  );
  return { ...screen, ...handlers };
}

function scrollEvent(row: number) {
  return { nativeEvent: { contentOffset: { x: 0, y: row * WHEEL_ROW_HEIGHT }, velocity: { y: 0 } } };
}

describe("DurationWheelSheet", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports only the minute a scroll comes to rest on", () => {
    const { getByTestId, onChange } = renderWheel();
    const minutes = getByTestId("duration-wheel-minute-scroll");

    fireEvent.scroll(minutes, scrollEvent(20));
    fireEvent.scroll(minutes, scrollEvent(10));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(minutes, "momentumScrollEnd", scrollEvent(10));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("ticks once for each row the drum turns past", () => {
    const { getByTestId } = renderWheel();

    fireEvent.scroll(getByTestId("duration-wheel-minute-scroll"), scrollEvent(47));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("springs back to the cap when it comes to rest past it", () => {
    const { getByTestId, onChange } = renderWheel(80, 92);

    fireEvent(getByTestId("duration-wheel-minute-scroll"), "momentumScrollEnd", scrollEvent(50));

    expect(onChange).toHaveBeenCalledWith(92);
  });

  it("dims the minutes past the cap", () => {
    const { getByTestId } = renderWheel(80, 92);

    expect(within(getByTestId("duration-wheel-minute-40")).getByText("40")).toHaveStyle({
      color: colors.textSecondary,
    });
    expect(within(getByTestId("duration-wheel-minute-20")).getByText("20")).toHaveStyle({
      color: colors.textPrimary,
    });
  });

  it("lets VoiceOver step each drum like a native picker", () => {
    const { getByTestId, onChange } = renderWheel();
    const minutes = getByTestId("duration-wheel-minute-drum");

    expect(minutes.props.accessibilityRole).toBe("adjustable");
    expect(minutes.props.accessibilityValue).toEqual({ text: "46 min" });

    fireEvent(minutes, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onChange).toHaveBeenCalledWith(47);
  });

  it("keeps the choice when saved", () => {
    const { getByLabelText, onSave, onCancel } = renderWheel();

    fireEvent.press(getByLabelText("Save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("drops the choice when cancelled", () => {
    const { getByTestId, onSave, onCancel } = renderWheel();

    fireEvent.press(getByTestId("duration-wheel-cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
