import { type ReactNode, useState } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import Animated, { type CSSTransitionProperties, cubicBezier } from "react-native-reanimated";

const PRESS_TRANSITION: CSSTransitionProperties = {
  transitionProperty: "transform",
  transitionDuration: 120,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
};

type Props = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Pressable that sinks to 97% on touch-down, the press feedback every tappable card shares. */
export function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  ...pressableProps
}: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      hitSlop={8}
      pressRetentionOffset={16}
      {...pressableProps}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[styles.base, PRESS_TRANSITION, style, pressed && styles.pressed]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { transform: [{ scale: 1 }] },
  pressed: { transform: [{ scale: 0.97 }] },
});
