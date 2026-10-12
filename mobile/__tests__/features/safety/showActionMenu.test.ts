import { ActionSheetIOS, Alert, type AlertButton, Platform } from "react-native";

import { showActionMenu } from "../../../features/safety/showActionMenu";

const report = jest.fn();
const block = jest.fn();
const menu = {
  title: "bob",
  cancelLabel: "Cancel",
  items: [
    { label: "Report", onSelect: report },
    { label: "Block", destructive: true, onSelect: block },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("showActionMenu on iOS", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => undefined);
  });

  it("opens a native action sheet with cancel last and destructive items marked", () => {
    showActionMenu(menu);

    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "bob",
        options: ["Report", "Block", "Cancel"],
        cancelButtonIndex: 2,
        destructiveButtonIndex: [1],
      }),
      expect.any(Function),
    );
  });

  it("runs the picked item and nothing on cancel", () => {
    showActionMenu(menu);
    const onPick = jest.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0][1];

    onPick(1);
    onPick(2);

    expect(block).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });
});

describe("showActionMenu on Android", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  it("falls back to a dismissable dialog with one button per item", () => {
    showActionMenu(menu);

    const [title, , buttons, options] = jest.mocked(Alert.alert).mock.calls[0];
    (buttons as AlertButton[])[0].onPress?.();

    expect(title).toBe("bob");
    expect((buttons as AlertButton[]).map((button) => button.text)).toEqual(["Report", "Block"]);
    expect(options).toEqual({ cancelable: true });
    expect(report).toHaveBeenCalledTimes(1);
  });
});
