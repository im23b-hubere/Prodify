import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
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
  /** Makes the whole card one tap target (header included) with a chevron in the header. */
  pressable?: {
    onPress: () => void;
    accessibilityLabel: string;
    accessibilityHint?: string;
    testID?: string;
  };
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
  pressable,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showBody = !collapsible || expanded;
  const headerSubtitle = collapsible && !expanded && collapsedHint ? collapsedHint : subtitle;

  if (pressable && !collapsible) {
    return (
      <AppCard style={styles.shell} testID={testID}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pressable.accessibilityLabel}
          accessibilityHint={pressable.accessibilityHint}
          testID={pressable.testID}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            pressable.onPress();
          }}
          style={({ pressed }) => [styles.pressableCard, pressed && { opacity: 0.88 }]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <ChevronRight color={colors.textSecondary} size={20} style={styles.headerChevron} />
          </View>
          <View style={styles.body}>{children}</View>
        </Pressable>
      </AppCard>
    );
  }

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
  pressableCard: {
    gap: spacing.md,
  },
  headerChevron: {
    marginTop: 4,
  },
  collapsedPreview: {
    marginTop: -spacing.xs,
  },
  body: {
    gap: spacing.md,
  },
});
