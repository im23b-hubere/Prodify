import type { SkillTreeNodeLayout, TreePoint } from "./skillTreeLayout";

/** A fingertip's reach: zoomed out, small nodes stay easy to hit without precise aiming. */
const MIN_TOUCH_RADIUS = 26;
const TOUCH_SLOP = 8;

export type SkillTreeCamera = {
  scale: number;
  translateX: number;
  translateY: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasSize: number;
};

export type HitTestNode<Id extends string = SkillTreeNodeLayout["id"]> = TreePoint & {
  id: Id;
  size: number;
};

/** The node nearest to a touch in viewport coordinates, if one is within reach of it. */
export function nodeAtPoint<Id extends string>(
  point: TreePoint,
  camera: SkillTreeCamera,
  nodes: readonly HitTestNode<Id>[],
): Id | null {
  "worklet";
  let nearestId: Id | null = null;
  let nearestDistance = Infinity;
  for (const node of nodes) {
    const screenX =
      camera.viewportWidth / 2 +
      camera.translateX +
      (node.x - camera.canvasSize / 2) * camera.scale;
    const screenY =
      camera.viewportHeight / 2 +
      camera.translateY +
      (node.y - camera.canvasSize / 2) * camera.scale;
    const distance = Math.hypot(point.x - screenX, point.y - screenY);
    const reach = Math.max((node.size / 2) * camera.scale + TOUCH_SLOP, MIN_TOUCH_RADIUS);
    if (distance <= reach && distance < nearestDistance) {
      nearestId = node.id;
      nearestDistance = distance;
    }
  }
  return nearestId;
}
