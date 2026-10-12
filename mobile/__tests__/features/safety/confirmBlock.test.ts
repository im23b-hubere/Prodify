import { Alert, type AlertButton } from "react-native";

import { confirmBlock } from "../../../features/safety/confirmBlock";
import { mockTFunction } from "../../helpers/mockTFunction";

const t = mockTFunction((key, options) => (options?.name ? `${key}:${options.name}` : key));

function pressedButton(label: string): AlertButton | undefined {
  const buttons = (jest.mocked(Alert.alert).mock.calls[0]?.[2] ?? []) as AlertButton[];
  return buttons.find((button) => button.text === label);
}

beforeEach(() => {
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("confirmBlock", () => {
  it("explains what blocking does before anything happens", () => {
    const onConfirm = jest.fn();

    confirmBlock({ name: "bob", t, onConfirm });

    expect(Alert.alert).toHaveBeenCalledWith(
      "safety.block.confirmTitle:bob",
      "safety.block.confirmBody",
      expect.any(Array),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks only after the destructive button", () => {
    const onConfirm = jest.fn();
    confirmBlock({ name: "bob", t, onConfirm });

    const block = pressedButton("safety.block.confirmAction");
    block?.onPress?.();

    expect(block?.style).toBe("destructive");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
