import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

const TRACK_PADDING = 3;
const TRACK_BORDER = 1;
// Quick, lightly damped slide (same feel as the SportLens segmented control).
const THUMB_SPRING = { damping: 22, stiffness: 240, mass: 0.7 } as const;

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Pill-shaped switch whose highlighted thumb springs to the selected option. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const index = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.value = withSpring(index, THUMB_SPRING);
  }, [index, progress]);

  const segmentWidth =
    trackWidth > 0 ? (trackWidth - (TRACK_PADDING + TRACK_BORDER) * 2) / options.length : 0;
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * segmentWidth }],
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.thumb, { width: segmentWidth }, thumbStyle]} />
      ) : null}
      {options.map((option, optionIndex) => (
        <Segment
          key={option.value}
          label={option.label}
          index={optionIndex}
          selected={optionIndex === index}
          progress={progress}
          onPress={() => {
            if (optionIndex === index) return;
            Haptics.selectionAsync().catch(() => undefined);
            onChange(option.value);
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  selected,
  progress,
  onPress,
}: {
  label: string;
  index: number;
  selected: boolean;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const labelStyle = useAnimatedStyle(() => {
    const amount = 1 - Math.min(Math.abs(progress.value - index), 1);
    return {
      color: interpolateColor(amount, [0, 1], [colors.textSecondary, colors.textPrimary]),
    };
  });

  return (
    <Pressable
      onPress={onPress}
      style={styles.segment}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: TRACK_PADDING,
    borderRadius: radii.round,
    borderWidth: TRACK_BORDER,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumb: {
    position: "absolute",
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.16)",
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
