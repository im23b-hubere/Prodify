import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, spacing } from "../../constants/theme";

/** The sheet stops short of the top so the dimmed screen behind shows it can be dismissed. */
const SHEET_HEIGHT_RATIO = 0.86;
const SHEET_OPEN_TIMING = { duration: 340, easing: Easing.bezier(0.23, 1, 0.32, 1) };
const SHEET_CLOSE_TIMING = { duration: 240, easing: Easing.bezier(0.4, 0, 1, 1) };
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * Slides the sheet up on open, and closes it on a backdrop tap, a grabber tap or a drag down far
 * or fast enough; a shorter drag springs back.
 */
function useSwipeDownSheet(visible: boolean, height: number, onClose: () => void) {
  const offset = useSharedValue(height);

  useEffect(() => {
    if (!visible) return;
    offset.value = height;
    offset.value = withTiming(0, SHEET_OPEN_TIMING);
  }, [height, offset, visible]);

  const close = useCallback(() => {
    offset.value = withTiming(height, SHEET_CLOSE_TIMING, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [height, offset, onClose]);

  // Horizontal drags fail this gesture, so carousels inside the sheet keep their swipes.
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-16, 16])
        .onUpdate((event) => {
          offset.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            offset.value = withTiming(height, SHEET_CLOSE_TIMING, (finished) => {
              if (finished) runOnJS(onClose)();
            });
          } else {
            offset.value = withSpring(0, { damping: 24, stiffness: 260 });
          }
        }),
    [height, offset, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, height], [1, 0], Extrapolation.CLAMP),
  }));

  return { close, drag, sheetStyle, backdropStyle };
}

type SwipeSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Read out for the backdrop and the grabber, which both close the sheet. */
  closeLabel: string;
  /** Sits under the grabber and always drags the sheet. */
  header?: ReactNode;
  /** Receives `close`, which slides the sheet away before calling `onClose`. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** A shorter sheet for short content; never taller than the default. */
  height?: number;
  /**
   * Whether a downward drag anywhere on the sheet closes it. Turn it off when the content
   * scrolls vertically; the grabber and header still drag.
   */
  dragAnywhere?: boolean;
  testID?: string;
};

/**
 * The app's bottom sheet: most of the screen tall over a dimmed backdrop, with a grabber.
 * Swipe it down, tap the grabber or tap the backdrop to close.
 */
export function SwipeSheet({
  visible,
  onClose,
  closeLabel,
  header,
  children,
  dragAnywhere = true,
  height: requestedHeight,
  testID,
}: SwipeSheetProps) {
  const fullHeight = Math.round(useWindowDimensions().height * SHEET_HEIGHT_RATIO);
  const height = Math.min(requestedHeight ?? fullHeight, fullHeight);
  const sheet = useSwipeDownSheet(visible, height, onClose);
  const content = typeof children === "function" ? children(sheet.close) : children;

  const top = (
    <View>
      <Pressable
        onPress={sheet.close}
        hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}
        style={styles.grabberHit}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      >
        <View style={styles.grabber} />
      </Pressable>
      {header}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={sheet.close}
    >
      {/* Modals are a separate native hierarchy on iOS — gestures need their own root here. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, sheet.backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={sheet.close}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, { height }, sheet.sheetStyle]} testID={testID}>
          {dragAnywhere ? (
            <GestureDetector gesture={sheet.drag}>
              <View style={styles.fill}>
                {top}
                {content}
              </View>
            </GestureDetector>
          ) : (
            <>
              <GestureDetector gesture={sheet.drag}>{top}</GestureDetector>
              {content}
            </>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  grabberHit: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
});
