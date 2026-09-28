import { StyleSheet } from "react-native";

import { colors, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: ui.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md },
  pathScreen: { flex: 1 },
  pathCap: { position: "absolute", left: 0, right: 0, height: "50%" },
  pathCapTop: { top: 0 },
  pathCapBottom: { bottom: 0 },
  pathTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: ui.screenPadding,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  pathScroll: { flex: 1 },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  infoButtonPressed: { opacity: 0.7 },
  levelTitle: { color: colors.textPrimary, ...typography.cardTitle },
  metaLine: { color: colors.textSecondary, ...typography.meta, marginTop: spacing.xs },
});
