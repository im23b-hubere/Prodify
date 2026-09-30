import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { listStyles as styles } from "./listStyles";

type Props = {
  title: string;
  /** Shown next to the title once there is more than one item. */
  count?: number;
  /** Trailing header control, e.g. a period switch. */
  right?: ReactNode;
  /** Wraps the children in a card; off for content that brings its own surface. */
  carded?: boolean;
  children: ReactNode;
  testID?: string;
};

export function ListSection({ title, count, right, carded = true, children, testID }: Props) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {count != null && count > 1 ? <Text style={styles.sectionCount}>{count}</Text> : null}
        {right ? <View style={styles.sectionRight}>{right}</View> : null}
      </View>
      {carded ? <View style={styles.card}>{children}</View> : children}
    </View>
  );
}
