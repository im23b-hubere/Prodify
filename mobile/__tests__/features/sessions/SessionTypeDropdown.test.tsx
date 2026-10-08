import { fireEvent, render, screen } from "@testing-library/react-native";
import { Dimensions, View } from "react-native";

import { ScrollRevealProvider } from "../../../components/ui/ScrollReveal";
import { SessionTypeDropdown } from "../../../features/sessions/components/SessionTypeDropdown";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const FIELD = "sessionDetail.sessionTypeDropdownA11y";
const SCREEN_HEIGHT = Dimensions.get("window").height;

function fieldAt(...ys: number[]) {
  const measure = jest.spyOn(View.prototype, "measureInWindow");
  ys.forEach((y) => measure.mockImplementationOnce((callback) => callback(16, y, 360, 48)));
  return measure;
}

describe("SessionTypeDropdown", () => {
  afterEach(() => jest.restoreAllMocks());

  it("drops a menu of every type and closes it after a pick", async () => {
    fieldAt(120);
    const onChange = jest.fn();
    render(<SessionTypeDropdown value="mastering" onChange={onChange} />);

    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    fireEvent.press(screen.getByLabelText(FIELD));
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(11);
    expect(items.filter((item) => item.props.accessibilityState?.selected)).toHaveLength(1);

    fireEvent.press(items[2]!);
    expect(onChange).toHaveBeenCalledWith("mixing");
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("closes without a change when the backdrop is tapped", async () => {
    fieldAt(120);
    const onChange = jest.fn();
    render(<SessionTypeDropdown value="mastering" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText(FIELD));
    fireEvent.press(await screen.findByLabelText("common.close"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("scrolls the page up first when the full menu would not fit below the field", async () => {
    fieldAt(SCREEN_HEIGHT - 120, 200);
    const reveal = jest.fn((_pixels: number) => Promise.resolve());
    render(
      <ScrollRevealProvider value={reveal}>
        <SessionTypeDropdown value="mastering" onChange={jest.fn()} />
      </ScrollRevealProvider>,
    );

    fireEvent.press(screen.getByLabelText(FIELD));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(11);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0]![0]).toBeGreaterThan(0);
  });

  it("opens in place when the menu already fits", async () => {
    fieldAt(120);
    const reveal = jest.fn((_pixels: number) => Promise.resolve());
    render(
      <ScrollRevealProvider value={reveal}>
        <SessionTypeDropdown value="mastering" onChange={jest.fn()} />
      </ScrollRevealProvider>,
    );

    fireEvent.press(screen.getByLabelText(FIELD));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(11);
    expect(reveal).not.toHaveBeenCalled();
  });
});
