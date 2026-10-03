/**
 * Scale for a node name inside the zoomed canvas. Zoomed in, it cancels the camera so names
 * stay at their designed size and sharp. Zoomed out, names shrink with the tree: the overview
 * is too dense for full-size names without them covering each other.
 */
export function labelCounterScale(cameraScale: number) {
  "worklet";
  return 1 / Math.max(1, cameraScale);
}
