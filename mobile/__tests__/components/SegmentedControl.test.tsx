import { fireEvent, render } from "@testing-library/react-native";

import { SegmentedControl } from "../../components/ui/SegmentedControl";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

const OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "tools", label: "Crew" },
] as const;

describe("SegmentedControl", () => {
  it("reports the tapped option and marks the current one as selected", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <SegmentedControl options={OPTIONS} value="overview" onChange={onChange} />,
    );

    expect(getByLabelText("Overview").props.accessibilityState).toEqual({ selected: true });
    expect(getByLabelText("Crew").props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(getByLabelText("Crew"));
    expect(onChange).toHaveBeenCalledWith("tools");
  });

  it("ignores taps on the option that is already selected", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <SegmentedControl options={OPTIONS} value="overview" onChange={onChange} />,
    );

    fireEvent.press(getByLabelText("Overview"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
