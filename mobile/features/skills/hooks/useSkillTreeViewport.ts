import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";

import type { TreePoint } from "../skillTreeLayout";

/** Opening zoom: focus nodes and their names are readable straight away. */
const START_SCALE = 0.8;
const FOCUS_SCALE = 1;
/** Kept low because the SVG layer turns soft when it is scaled far beyond its drawn size. */
const MAX_SCALE = 1.4;
const FIT_MARGIN = 0.96;
/** The camera starts a little further out and glides in once the tree has loaded. */
const INTRO_SCALE_RATIO = 0.82;
const EDGE_SLACK = 80;
/** Lets the outermost skills reach the centre of the screen. */
const NODE_REACH_RATIO = 0.45;
const OVERSTRETCH_RESISTANCE = 0.3;

const CAMERA_SPRING = { duration: 650, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const SETTLE_SPRING = { duration: 400, dampingRatio: 0.85, reduceMotion: ReduceMotion.System };

type ViewportSize = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/** Movement past a limit only follows the finger partially, like a rubber band. */
function resist(value: number, min: number, max: number) {
  "worklet";
  if (value > max) return max + (value - max) * OVERSTRETCH_RESISTANCE;
  if (value < min) return min - (min - value) * OVERSTRETCH_RESISTANCE;
  return value;
}

/** Past the edge a drag only moves the tree partially, as if held back by a rubber band. */
function dragAxis(position: number, change: number, reach: number) {
  "worklet";
  const isPullingOutward = Math.abs(position) >= reach && Math.sign(change) === Math.sign(position);
  return position + (isPullingOutward ? change * OVERSTRETCH_RESISTANCE : change);
}

type CameraTarget = { scale: number; x: number; y: number };

/** Camera position that shows `point` in the viewport centre, lifted by `liftBy`. */
function cameraTarget(point: TreePoint, scale: number, canvasSize: number, liftBy: number): CameraTarget {
  "worklet";
  return {
    scale,
    x: -(point.x - canvasSize / 2) * scale,
    y: -(point.y - canvasSize / 2) * scale - liftBy,
  };
}

/**
 * Camera for a square canvas centred in the viewport: pinch, pan with momentum and double-tap,
 * all on the UI thread. Zooming keeps the point under the fingers still.
 */
export function useSkillTreeViewport(canvasSize: number) {
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const wasPinched = useSharedValue(false);
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  const fitScale = viewport ? (Math.min(width, height) / canvasSize) * FIT_MARGIN : 1;
  const minScale = fitScale * 0.9;

  const hasMeasured = useRef(false);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      if (!hasMeasured.current) {
        hasMeasured.current = true;
        scale.set(START_SCALE * INTRO_SCALE_RATIO);
      }
      setViewport((previous) =>
        previous?.width === nextWidth && previous?.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    },
    [scale],
  );

  const reachAt = (atScale: number, axisSize: number) => {
    "worklet";
    return Math.max(
      Math.max(0, (canvasSize * atScale - axisSize) / 2) + EDGE_SLACK,
      canvasSize * NODE_REACH_RATIO * atScale,
    );
  };

  /** Springs scale and position back inside their limits after a gesture overshot them. */
  const settle = () => {
    "worklet";
    const targetScale = clamp(scale.get(), minScale, MAX_SCALE);
    const ratio = targetScale / scale.get();
    const reachX = reachAt(targetScale, width);
    const reachY = reachAt(targetScale, height);
    scale.set(withSpring(targetScale, SETTLE_SPRING));
    translateX.set(withSpring(clamp(translateX.get() * ratio, -reachX, reachX), SETTLE_SPRING));
    translateY.set(withSpring(clamp(translateY.get() * ratio, -reachY, reachY), SETTLE_SPRING));
  };

  /** Momentum after a flick; a release past the edge springs straight back instead. */
  const glideFrom = (position: number, velocity: number, reach: number) => {
    "worklet";
    if (Math.abs(position) > reach) {
      return withSpring(clamp(position, -reach, reach), SETTLE_SPRING);
    }
    return withDecay({
      velocity,
      clamp: [-reach, reach],
      rubberBandEffect: true,
      rubberBandFactor: 0.7,
      reduceMotion: ReduceMotion.System,
    });
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
      wasPinched.set(true);
      pinchStartScale.set(scale.get());
    })
    .onUpdate((event) => {
      const nextScale = resist(pinchStartScale.get() * event.scale, minScale, MAX_SCALE);
      zoomAround(event.focalX, event.focalY, nextScale);
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      wasPinched.set(false);
    })
    .onChange((event) => {
      translateX.set(dragAxis(translateX.get(), event.changeX, reachAt(scale.get(), width)));
      translateY.set(dragAxis(translateY.get(), event.changeY, reachAt(scale.get(), height)));
    })
    .onEnd((event) => {
      if (wasPinched.get()) {
        settle();
        return;
      }
      translateX.set(glideFrom(translateX.get(), event.velocityX, reachAt(scale.get(), width)));
      translateY.set(glideFrom(translateY.get(), event.velocityY, reachAt(scale.get(), height)));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const isZoomedIn = scale.get() > fitScale * 1.3;
      const tappedPoint = {
        x: canvasSize / 2 + (event.x - width / 2 - translateX.get()) / scale.get(),
        y: canvasSize / 2 + (event.y - height / 2 - translateY.get()) / scale.get(),
      };
      const target = isZoomedIn
        ? cameraTarget({ x: canvasSize / 2, y: canvasSize / 2 }, fitScale, canvasSize, 0)
        : cameraTarget(tappedPoint, FOCUS_SCALE, canvasSize, 0);
      scale.set(withSpring(target.scale, CAMERA_SPRING));
      translateX.set(withSpring(target.x, CAMERA_SPRING));
      translateY.set(withSpring(target.y, CAMERA_SPRING));
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const flyTo = useCallback(
    (point: TreePoint, targetScale: number, liftBy = 0) => {
      const nextScale = clamp(targetScale, minScale, MAX_SCALE);
      const target = cameraTarget(point, nextScale, canvasSize, liftBy);
      scale.set(withSpring(target.scale, CAMERA_SPRING));
      translateX.set(withSpring(target.x, CAMERA_SPRING));
      translateY.set(withSpring(target.y, CAMERA_SPRING));
    },
    [canvasSize, minScale, scale, translateX, translateY],
  );

  /** Glides a canvas point to the centre, lifted by `liftBy` for overlays below. */
  const focusOn = useCallback(
    (point: TreePoint, liftBy = 0) => flyTo(point, Math.max(FOCUS_SCALE, scale.get()), liftBy),
    [flyTo, scale],
  );

  /** The opening camera move from slightly further out to a readable zoom. */
  const introduce = useCallback((point: TreePoint) => flyTo(point, START_SCALE), [flyTo]);

  const showWholeTree = useCallback(
    () => flyTo({ x: canvasSize / 2, y: canvasSize / 2 }, fitScale),
    [canvasSize, fitScale, flyTo],
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
    viewportSize: viewport,
    canvasOffset: { left: (width - canvasSize) / 2, top: (height - canvasSize) / 2 },
    onLayout,
    gesture,
    canvasStyle,
    scale,
    translateX,
    translateY,
    focusOn,
    introduce,
    showWholeTree,
  };
}