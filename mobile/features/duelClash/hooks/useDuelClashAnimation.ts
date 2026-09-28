import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** The moment both sides meet: VS lands, the line flashes, the haptic fires. */
const IMPACT_MS = 440;
const AUTO_DISMISS_MS = 3200;
const EXIT_MS = 200;

export function useDuelClashAnimation(onFinished: () => void) {
  const reduced = useReducedMotion();
  const backdrop = useSharedValue(0);
  const panel = useSharedValue(0);
  const opponent = useSharedValue(0);
  const you = useSharedValue(0);
  const impact = useSharedValue(0);
  const vsScale = useSharedValue(reduced ? 1 : 1.35);
  const title = useSharedValue(0);
  const exiting = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const exit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    backdrop.set(withTiming(0, { duration: EXIT_MS, easing: EASE_OUT }));
    timers.current.push(setTimeout(onFinished, EXIT_MS));
  }, [backdrop, onFinished]);

  useEffect(() => {
    const enter = (duration: number, delay = 0) =>
      withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
    backdrop.set(enter(180));
    panel.set(enter(reduced ? 180 : 360));
    opponent.set(enter(320, reduced ? 0 : 140));
    you.set(enter(320, reduced ? 0 : 200));
    impact.set(enter(240, reduced ? 120 : IMPACT_MS));
    if (!reduced) {
      vsScale.set(withDelay(IMPACT_MS, withTiming(1, { duration: 260, easing: EASE_OUT })));
    }
    title.set(enter(260, reduced ? 160 : IMPACT_MS + 80));

    const pending = timers.current;
    pending.push(
      setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }, reduced ? 120 : IMPACT_MS),
    );
    pending.push(setTimeout(exit, AUTO_DISMISS_MS));
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, [backdrop, exit, impact, opponent, panel, reduced, title, vsScale, you]);

  const travel = reduced ? 0 : 1;
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panel.get(),
    transform: [{ translateX: (1 - panel.get()) * 240 * travel }, { rotate: "-8deg" }],
  }));
  const opponentStyle = useAnimatedStyle(() => ({
    opacity: opponent.get(),
    transform: [{ translateX: (1 - opponent.get()) * 96 * travel }],
  }));
  const youStyle = useAnimatedStyle(() => ({
    opacity: you.get(),
    transform: [{ translateX: (1 - you.get()) * -96 * travel }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: impact.get(),
    transform: [{ scaleX: 0.92 + impact.get() * 0.08 }],
  }));
  const vsStyle = useAnimatedStyle(() => ({
    opacity: impact.get(),
    transform: [{ scale: vsScale.get() }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.get(),
    transform: [{ translateY: (1 - title.get()) * 12 * travel }],
  }));

  return { exit, backdropStyle, panelStyle, opponentStyle, youStyle, lineStyle, vsStyle, titleStyle };
}
