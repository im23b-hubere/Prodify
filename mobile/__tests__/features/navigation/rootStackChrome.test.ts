import { colors } from "../../../constants/theme";
import {
  appRootFillStyle,
  rootStackScreenOptions,
} from "../../../features/navigation/rootStackChrome";

describe("root stack swipe policy", () => {
  it("does not let a fullscreen iOS swipe dismiss the launch index or the tab shell", () => {
    expect(rootStackScreenOptions("index")).toEqual(
      expect.objectContaining({
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      }),
    );
    expect(rootStackScreenOptions("(tabs)")).toEqual(
      expect.objectContaining({
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      }),
    );
  });

  it("keeps swipe-back on pushed cards so Settings still pops to the tab underneath", () => {
    expect(rootStackScreenOptions("settings").gestureEnabled).toBe(true);
    expect(rootStackScreenOptions("progression-overview").gestureEnabled).toBe(true);
    expect(rootStackScreenOptions("challenge/[id]").gestureEnabled).toBe(true);
  });

  it("paints the app root so a stack pop cannot flash the system window", () => {
    expect(appRootFillStyle).toEqual({
      flex: 1,
      backgroundColor: colors.background,
    });
  });
});
