/**
 * Scale for a node name inside the zoomed canvas. Zoomed in, it cancels the camera so names
 * stay at their designed size and sharp. Zoomed out, names shrink with the tree: the overview
 * is too dense for full-size names without them covering each other.
 */
export function labelCounterScale(cameraScale: number) {
  "worklet";
  return 1 / Math.max(1, cameraScale);
}

/** Focus names appear once an area fills the phone; area names a little earlier, for wayfinding. */
const FOCUS_LABEL_FADE = [0.22, 0.32] as const;
const BRANCH_LABEL_FADE = [0.14, 0.22] as const;

export function labelOpacity(cameraScale: number, kind: "branch" | "focus") {
  "worklet";
  const [hiddenAt, solidAt] = kind === "focus" ? FOCUS_LABEL_FADE : BRANCH_LABEL_FADE;
  if (cameraScale <= hiddenAt) return 0;
  if (cameraScale >= solidAt) return 1;
  return (cameraScale - hiddenAt) / (solidAt - hiddenAt);
}
