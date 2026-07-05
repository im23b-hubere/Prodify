import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppCard } from "../../../components/ui/AppCard";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  title: string;
  subtitle?: string | null;
  testID?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  collapsedHint?: string | null;
  collapsedPreview?: ReactNode;
  children: ReactNode;
};

export function StatsSection({
  title,
  subtitle,
  testID,
  collapsible = false,
  defaultExpanded = true,
  collapsedHint,
  collapsedPreview,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showBody = !collapsible || expanded;
  const headerSubtitle = collapsible && !expanded && collapsedHint ? collapsedHint : subtitle;

  return (
    <AppCard style={styles.shell} testID={testID}>
      <Pressable
        accessibilityRole={collapsible ? "button" : undefined}
        accessibilityState={collapsible ? { expanded } : undefined}
        disabled={!collapsible}
        onPress={
          collapsible
            ? () => {
                Haptics.selectionAsync().catch(() => undefined);
                setExpanded((value) => !value);
              }
            : undefined
        }
        style={({ pressed }) => [
          styles.header,
          collapsible && styles.headerPressable,
          collapsible && pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {headerSubtitle ? <Text style={styles.subtitle}>{headerSubtitle}</Text> : null}
        </View>
        {collapsible ? (
          expanded ? (
            <ChevronUp color={colors.textSecondary} size={18} />
          ) : (
            <ChevronDown color={colors.textSecondary} size={18} />
          )
        ) : null}
      </Pressable>
      {collapsible && !expanded && collapsedPreview ? (
        <View style={styles.collapsedPreview}>{collapsedPreview}</View>
      ) : null}
      {showBody ? <View style={styles.body}>{children}</View> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerPressable: {
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  collapsedPreview: {
    marginTop: -spacing.xs,
  },
  body: {
    gap: spacing.md,
  },
});
