import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { memo, type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  title: string;
  subtitle?: string | null;
  defaultExpanded?: boolean;
  /** When true, expands the section (e.g. relevant data available). */
  startExpanded?: boolean;
  testID?: string;
  children: ReactNode;
};

export const StatsCollapsibleSection = memo(function StatsCollapsibleSection({
  title,
  subtitle,
  defaultExpanded = false,
  startExpanded = false,
  testID,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || startExpanded);

  useEffect(() => {
    if (startExpanded) {
      setExpanded(true);
    }
  }, [startExpanded]);

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          setExpanded((v) => !v);
        }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && !expanded ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {expanded ? (
          <ChevronUp color={colors.secondary} size={20} />
        ) : (
          <ChevronDown color={colors.secondary} size={20} />
        )}
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerPressed: {
    opacity: 0.88,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
