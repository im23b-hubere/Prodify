import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { duelBoardStyles as styles } from "../duelBoard.styles";

type Props = {
  title: string;
  count?: number;
  /** Wraps the children in a card; off for content that brings its own surface. */
  carded?: boolean;
  children: ReactNode;
  testID?: string;
};

export function DuelBoardSection({ title, count, carded = true, children, testID }: Props) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {count != null && count > 1 ? <Text style={styles.sectionCount}>{count}</Text> : null}
      </View>
      {carded ? <View style={styles.card}>{children}</View> : children}
    </View>
  );
}
