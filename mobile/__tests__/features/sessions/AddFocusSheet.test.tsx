import { fireEvent, render, screen } from "@testing-library/react-native";

import { AddFocusSheet } from "../../../features/sessions/components/AddFocusSheet";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-gesture-handler", () => require("../../../test/gestureHandlerStub"));
jest.mock("../../../components/ui/PrimaryButton", () => {
  const { Pressable, Text } = require("react-native");
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

const checked = (id: string) =>
  screen.getByTestId(`add-focus-${id}`).props.accessibilityState?.checked;

function renderSheet(selectedIds: string[]) {
  const onSave = jest.fn();
  render(
    <AddFocusSheet
      visible
      sessionType="beat_making"
      selectedIds={selectedIds as never}
      onSave={onSave}
      onClose={jest.fn()}
    />,
  );
  return { onSave };
}

describe("AddFocusSheet", () => {
  it("keeps credited focuses in the list, ticked", () => {
    renderSheet(["beat_making.drums"]);

    expect(screen.getByText("sessionComplete.focusSheetTitle")).toBeTruthy();
    expect(checked("beat_making.drums")).toBe(true);
    expect(checked("beat_making.groove")).toBe(false);
  });

  it("only changes the ticks until Save, then hands over the new list", () => {
    const { onSave } = renderSheet(["beat_making.drums"]);

    fireEvent.press(screen.getByTestId("add-focus-beat_making.groove"));
    fireEvent.press(screen.getByTestId("add-focus-beat_making.drums"));
    expect(checked("beat_making.groove")).toBe(true);
    expect(checked("beat_making.drums")).toBe(false);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith(["beat_making.groove"]);
  });
});
