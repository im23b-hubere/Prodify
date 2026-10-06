import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { SkillBranch } from "../../../constants/skills";
import {
  MAX_SCALE,
  areaFitCamera,
  focusFitCamera,
  openingCamera,
  overviewCamera,
  toggleZoomCamera,
  type CameraPose,
  type OpeningNodeId,
} from "../skillTreeCamera";
import { nodeAtPoint, type SkillTreeCamera } from "../skillTreeHitTest";
import type { SkillTreeLayout, SkillTreeNodeLayout, TreePoint } from "../skillTreeLayout";

/** The camera starts a little further out and glides in once the tree has loaded. */
const INTRO_SCALE_RATIO = 0.82;
const EDGE_SLACK = 80;
/** Lets the outermost skills reach the centre of the screen. */
const NODE_REACH_RATIO = 0.45;
const OVERSTRETCH_RESISTANCE = 0.3;
/** Movement a tap tolerates; beyond it the finger is panning instead. */
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DISTANCE = 32;

const CAMERA_SPRING = { duration: 650, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const SETTLE_SPRING = { duration: 400, dampingRatio: 0.85, reduceMotion: ReduceMotion.System };

type ViewportSize = { width: number; height: number };
type TapRecord = { time: number; x: number; y: number };

const NO_TAP: TapRecord = { time: 0, x: 0, y: 0 };

type ViewportOptions = {
  /** Keeps a tapped node clear of the detail card that slides up from the bottom. */
  selectionLift: number;
  /** The tapped node, or null when the tap landed on empty canvas. */
  onTap: (id: SkillTreeNodeLayout["id"] | null) => void;
};

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

function springCameraTo(
  scale: SharedValue<number>,
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  target: CameraPose,
) {
  "worklet";
  scale.set(withSpring(target.scale, CAMERA_SPRING));
  translateX.set(withSpring(target.x, CAMERA_SPRING));
  translateY.set(withSpring(target.y, CAMERA_SPRING));
}

function tapRecordAt(point: TreePoint): TapRecord {
  "worklet";
  return { time: Date.now(), x: point.x, y: point.y };
}

function isQuickSecondTap(previous: TapRecord, current: TapRecord) {
  "worklet";
  return (
    current.time - previous.time < DOUBLE_TAP_MS &&
    Math.hypot(current.x - previous.x, current.y - previous.y) < DOUBLE_TAP_DISTANCE
  );
}

/** A light knock when the zoom hits a limit or a double-tap snaps the camera. */
function playCameraHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/**
 * Camera for a square canvas centred in the viewport: pinch, pan with momentum, tap and
 * double-tap, all on the UI thread. Zooming keeps the point under the fingers still.
 */
export function useSkillTreeViewport(layout: SkillTreeLayout, { selectionLift, onTap }: ViewportOptions) {
  const canvasSize = layout.size;
  const nodes = layout.nodes;
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const wasPinched = useSharedValue(false);
  const isPastZoomLimit = useSharedValue(false);
  const lastTap = useSharedValue<TapRecord>(NO_TAP);
  const pressedNodeId = useSharedValue<string | null>(null);
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  const view = { width, height };
  const fitScale = viewport ? overviewCamera(layout, view).scale : 1;
  const minScale = fitScale * 0.9;

  const hasMeasured = useRef(false);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      if (!hasMeasured.current) {
        hasMeasured.current = true;
        const overview = overviewCamera(layout, { width: nextWidth, height: nextHeight });
        scale.set(overview.scale * INTRO_SCALE_RATIO);
      }
      setViewport((previous) =>
        previous?.width === nextWidth && previous?.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    },
    [layout, scale],
  );

  const reachAt = (atScale: number, axisSize: number) => {
    "worklet";
    return Math.max(
      Math.max(0, (canvasSize * atScale - axisSize) / 2) + EDGE_SLACK,
      canvasSize * NODE_REACH_RATIO * atScale,
    );
  };

  const currentCamera = (): SkillTreeCamera => {
    "worklet";
    return {
      scale: scale.get(),
      translateX: translateX.get(),
      translateY: translateY.get(),
      viewportWidth: width,
      viewportHeight: height,
      canvasSize,
    };
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

  const worldPointAt = (point: TreePoint): TreePoint => {
    "worklet";
    return {
      x: canvasSize / 2 + (point.x - width / 2 - translateX.get()) / scale.get(),
      y: canvasSize / 2 + (point.y - height / 2 - translateY.get()) / scale.get(),
    };
  };

  const poseForNode = (node: SkillTreeNodeLayout, liftBy: number): CameraPose => {
    if (node.kind === "branch") return areaFitCamera(layout, node.id, view, liftBy);
    if (node.kind === "focus") return focusFitCamera(layout, node.id, view, liftBy);
    return overviewCamera(layout, view);
  };

  const snapToNode = (tappedId: SkillTreeNodeLayout["id"] | null) => {
    const tappedNode = nodes.find((node) => node.id === tappedId);
    if (tappedNode && tappedNode.kind !== "center") {
      springCameraTo(scale, translateX, translateY, poseForNode(tappedNode, selectionLift));
    }
    onTap(tappedId);
  };

  const snapToggleZoom = (worldX: number, worldY: number) => {
    springCameraTo(
      scale,
      translateX,
      translateY,
      toggleZoomCamera(layout, scale.get(), { x: worldX, y: worldY }, view),
    );
    playCameraHaptic();
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      wasPinched.set(true);
      isPastZoomLimit.set(false);
      pinchStartScale.set(scale.get());
    })
    .onUpdate((event) => {
      const requestedScale = pinchStartScale.get() * event.scale;
      const isPastLimit = requestedScale < minScale || requestedScale > MAX_SCALE;
      if (isPastLimit && !isPastZoomLimit.get()) scheduleOnRN(playCameraHaptic);
      isPastZoomLimit.set(isPastLimit);
      zoomAround(event.focalX, event.focalY, resist(requestedScale, minScale, MAX_SCALE));
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .minDistance(TAP_SLOP)
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

  // A second tap in quick succession zooms; single taps act at once instead of waiting for a
  // double-tap recognizer to give up.
  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onBegin((event) => {
      pressedNodeId.set(nodeAtPoint(event, currentCamera(), nodes));
    })
    .onEnd((event, success) => {
      if (!success) return;
      const current = tapRecordAt(event);
      if (isQuickSecondTap(lastTap.get(), current)) {
        lastTap.set(NO_TAP);
        const world = worldPointAt(event);
        scheduleOnRN(snapToggleZoom, world.x, world.y);
        return;
      }
      lastTap.set(current);
      const tappedId = nodeAtPoint(event, currentCamera(), nodes);
      scheduleOnRN(snapToNode, tappedId);
    })
    .onFinalize(() => {
      pressedNodeId.set(null);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, tap);

  const flyToPose = useCallback(
    (pose: CameraPose) => {
      springCameraTo(scale, translateX, translateY, pose);
    },
    [scale, translateX, translateY],
  );

  const fitArea = useCallback(
    (branch: SkillBranch, liftBy = 0) => {
      flyToPose(areaFitCamera(layout, branch, { width, height }, liftBy));
    },
    [flyToPose, height, layout, width],
  );

  const fitFocus = useCallback(
    (id: SkillTreeNodeLayout["id"], liftBy = 0) => {
      flyToPose(focusFitCamera(layout, id, { width, height }, liftBy));
    },
    [flyToPose, height, layout, width],
  );

  /** The opening camera move from the whole tree in toward the starting area. */
  const introduce = useCallback(
    (startId: OpeningNodeId) => flyToPose(openingCamera(layout, startId, { width, height })),
    [flyToPose, height, layout, width],
  );

  const showWholeTree = useCallback(
    () => flyToPose(overviewCamera(layout, { width, height })),
    [flyToPose, height, layout, width],
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
    /** The node under a finger that is still down, for press feedback. */
    pressedNodeId,
    fitArea,
    fitFocus,
    introduce,
    showWholeTree,
  };
}
