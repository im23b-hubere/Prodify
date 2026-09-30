import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { TreePoint } from "../skillTreeLayout";

const MAX_SCALE = 2.2;
const ZOOM_IN_SCALE = 1.2;
const FIT_MARGIN = 0.96;
/** Lets the tree be dragged a little past its edge so outer nodes can reach the centre. */
const EDGE_SLACK = 80;
const MOVE_TIMING = { duration: 420, easing: Easing.out(Easing.cubic) };

type ViewportSize = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * Pinch, pan and double-tap for a square canvas centred in the viewport. Zooming keeps the
 * point under the fingers still; everything runs on the UI thread.
 */
export function useSkillTreeViewport(canvasSize: number) {
  const reduceMotion = useReducedMotion();
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const fitScale = viewport
    ? (Math.min(viewport.width, viewport.height) / canvasSize) * FIT_MARGIN
    : 1;
  const minScale = fitScale * 0.9;
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;

  const hasMeasured = useRef(false);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      if (!hasMeasured.current) {
        hasMeasured.current = true;
        scale.set((Math.min(nextWidth, nextHeight) / canvasSize) * FIT_MARGIN);
      }
      setViewport((previous) =>
        previous?.width === nextWidth && previous?.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    },
    [canvasSize, scale],
  );

  const settleInsideBounds = () => {
    "worklet";
    const reachX = Math.max(0, (canvasSize * scale.get() - width) / 2) + EDGE_SLACK;
    const reachY = Math.max(0, (canvasSize * scale.get() - height) / 2) + EDGE_SLACK;
    translateX.set(withTiming(clamp(translateX.get(), -reachX, reachX), MOVE_TIMING));
    translateY.set(withTiming(clamp(translateY.get(), -reachY, reachY), MOVE_TIMING));
  };

  const zoomAround = (focalX: number, focalY: number, nextScale: number) => {
    "worklet";
    const ratio = nextScale / scale.get();
    const fromCenterX = focalX - width / 2;
    const fromCenterY = focalY - height / 2;
    translateX.set(fromCenterX - (fromCenterX - translateX.get()) * ratio);
    translateY.set(fromCenterY - (fromCenterY - translateY.get()) * ratio);
    scale.set(nextScale);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.set(scale.get());
    })
    .onUpdate((event) => {
      const nextScale = clamp(pinchStartScale.get() * event.scale, minScale, MAX_SCALE);
      zoomAround(event.focalX, event.focalY, nextScale);
    })
    .onEnd(settleInsideBounds);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onChange((event) => {
      translateX.set(translateX.get() + event.changeX);
      translateY.set(translateY.get() + event.changeY);
    })
    .onEnd(settleInsideBounds);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const isZoomedIn = scale.get() > fitScale * 1.3;
      if (isZoomedIn) {
        scale.set(withTiming(fitScale, MOVE_TIMING));
        translateX.set(withTiming(0, MOVE_TIMING));
        translateY.set(withTiming(0, MOVE_TIMING));
        return;
      }
      const ratio = ZOOM_IN_SCALE / scale.get();
      const fromCenterX = event.x - width / 2;
      const fromCenterY = event.y - height / 2;
      translateX.set(withTiming(fromCenterX - (fromCenterX - translateX.get()) * ratio, MOVE_TIMING));
      translateY.set(withTiming(fromCenterY - (fromCenterY - translateY.get()) * ratio, MOVE_TIMING));
      scale.set(withTiming(ZOOM_IN_SCALE, MOVE_TIMING));
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  /** Glides a canvas point to the viewport centre, lifted by `liftBy` for overlays below. */
  const focusOn = useCallback(
    (point: TreePoint, liftBy = 0) => {
      const nextScale = Math.max(ZOOM_IN_SCALE, scale.get());
      const targetX = -(point.x - canvasSize / 2) * nextScale;
      const targetY = -(point.y - canvasSize / 2) * nextScale - liftBy;
      if (reduceMotion) {
        scale.set(nextScale);
        translateX.set(targetX);
        translateY.set(targetY);
        return;
      }
      scale.set(withTiming(nextScale, MOVE_TIMING));
      translateX.set(withTiming(targetX, MOVE_TIMING));
      translateY.set(withTiming(targetY, MOVE_TIMING));
    },
    [canvasSize, reduceMotion, scale, translateX, translateY],
  );

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return {
    isMeasured: viewport !== null,
    canvasOffset: { left: (width - canvasSize) / 2, top: (height - canvasSize) / 2 },
    onLayout,
    gesture,
    canvasStyle,
    scale,
    focusOn,
  };
}
