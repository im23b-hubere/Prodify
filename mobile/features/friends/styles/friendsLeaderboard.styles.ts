import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  podiumBronze: {
    borderColor: "rgba(205,127,50,0.5)",
    backgroundColor: "rgba(205,127,50,0.08)",
  },
  podiumCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
  },
  podiumCell: {
    width: "31%",
    minWidth: 96,
    flexGrow: 1,
  },
  podiumGold: {
    borderColor: "rgba(251,191,36,0.5)",
    backgroundColor: "rgba(251,191,36,0.09)",
  },
  podiumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  podiumSilver: {
    borderColor: "rgba(209,213,219,0.5)",
    backgroundColor: "rgba(209,213,219,0.08)",
  },
});

export const friendsLeaderboardStyles = { ...friendsSharedStyles, ...localStyles };
