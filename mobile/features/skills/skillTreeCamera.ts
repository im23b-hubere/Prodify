import { SKILL_BRANCHES, type SkillBranch } from "../../constants/skills";
import {
  ringRadius,
  type SkillTreeLayout,
  type SkillTreeNodeLayout,
  type TreePoint,
} from "./skillTreeLayout";

export const MAX_SCALE = 1.15;
export const FIT_MARGIN = 0.96;
const AREA_PADDING = 36;

export type ViewportSize = { width: number; height: number };
export type CameraPose = { scale: number; x: number; y: number };
export type OpeningNodeId = "center" | SkillBranch;

type WorldBox = { minX: number; minY: number; maxX: number; maxY: number };

export function cameraToPoint(
  point: TreePoint,
  scale: number,
  canvasSize: number,
  liftBy = 0,
): CameraPose {
  return {
    scale,
    x: -(point.x - canvasSize / 2) * scale,
    y: -(point.y - canvasSize / 2) * scale - liftBy,
  };
}

export function projectToScreen(
  point: TreePoint,
  pose: CameraPose,
  viewport: ViewportSize,
  canvasSize: number,
): TreePoint {
  return {
    x: viewport.width / 2 + pose.x + (point.x - canvasSize / 2) * pose.scale,
    y: viewport.height / 2 + pose.y + (point.y - canvasSize / 2) * pose.scale,
  };
}

export function nodesOfArea(layout: SkillTreeLayout, branch: SkillBranch): SkillTreeNodeLayout[] {
  return layout.nodes.filter((node) => node.kind === "center" || node.branch === branch);
}

export function nearestArea(layout: SkillTreeLayout, point: TreePoint): SkillBranch {
  let closest: SkillBranch | null = null;
  let closestDistance = Infinity;
  for (const node of layout.nodes) {
    if (node.kind === "center") continue;
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = node.branch;
    }
  }
  return closest ?? SKILL_BRANCHES[0];
}

export function overviewCamera(layout: SkillTreeLayout, viewport: ViewportSize): CameraPose {
  return fitBox(
    { minX: 0, minY: 0, maxX: layout.size, maxY: layout.size },
    viewport,
    layout.size,
    0,
  );
}

export function areaFitCamera(
  layout: SkillTreeLayout,
  branch: SkillBranch,
  viewport: ViewportSize,
  liftBy = 0,
): CameraPose {
  return fitBox(occupancyBox(nodesOfArea(layout, branch)), viewport, layout.size, liftBy);
}

export function focusFitCamera(
  layout: SkillTreeLayout,
  focusId: SkillTreeNodeLayout["id"],
  viewport: ViewportSize,
  liftBy: number,
): CameraPose {
  const node = layout.nodes.find((item) => item.id === focusId);
  if (!node || node.kind === "center") return overviewCamera(layout, viewport);
  const area = areaFitCamera(layout, node.branch, viewport, liftBy);
  return cameraToPoint(node, area.scale, layout.size, liftBy);
}

export function openingCamera(
  layout: SkillTreeLayout,
  startId: OpeningNodeId,
  viewport: ViewportSize,
): CameraPose {
  if (startId === "center") return overviewCamera(layout, viewport);
  return areaFitCamera(layout, startId, viewport);
}

export function toggleZoomCamera(
  layout: SkillTreeLayout,
  currentScale: number,
  point: TreePoint,
  viewport: ViewportSize,
): CameraPose {
  const overview = overviewCamera(layout, viewport);
  if (currentScale > overview.scale * 1.3) return overview;
  return areaFitCamera(layout, nearestArea(layout, point), viewport);
}

function occupancyBox(nodes: readonly SkillTreeNodeLayout[]): WorldBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const radius = ringRadius(node.size);
    minX = Math.min(minX, node.x - radius);
    minY = Math.min(minY, node.y - radius);
    maxX = Math.max(maxX, node.x + radius);
    maxY = Math.max(maxY, node.y + radius);
    if (node.kind === "center") continue;
    minX = Math.min(minX, node.label.x);
    minY = Math.min(minY, node.label.y);
    maxX = Math.max(maxX, node.label.x + node.label.width);
    maxY = Math.max(maxY, node.label.y + node.label.height);
  }
  return { minX, minY, maxX, maxY };
}

function fitBox(box: WorldBox, viewport: ViewportSize, canvasSize: number, liftBy: number): CameraPose {
  const width = Math.max(1, box.maxX - box.minX + AREA_PADDING * 2);
  const height = Math.max(1, box.maxY - box.minY + AREA_PADDING * 2);
  const usableHeight = Math.max(1, viewport.height - liftBy);
  const scale = Math.min(MAX_SCALE, Math.min(viewport.width / width, usableHeight / height) * FIT_MARGIN);
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  return cameraToPoint(center, scale, canvasSize, liftBy / 2);
}
