import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import {
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { WHEEL_HEIGHT, WHEEL_ROW_HEIGHT, wheelIndexAt, wheelRowPose } from "../durationWheel";
import { wheelStyles as styles } from "../durationWheel.styles";

const ACCESSIBILITY_ACTIONS = [{ name: "increment" }, { name: "decrement" }];
/** Release speeds below this end a drag without momentum, so the drum rests where it was let go. */
const RESTING_VELOCITY = 0.05;

type DurationDrumProps = {
  /** Rows show 0 to `count - 1`. */
  count: number;
  selected: number;
  /** The highest row the drum may rest on; rows above it are dimmed and spring back. */
  limit: number;
  unit: string;
  testIDPrefix: string;
  onSelect: (value: number) => void;
};

function tickHaptic() {
  Haptics.selectionAsync().catch(() => undefined);
}

/**
 * One iOS-style picker drum. It turns freely with momentum and ticks on every row; the value is
 * reported once the drum comes to rest, so the screen behind never re-renders mid-flick.
 */
export function DurationDrum({
  count,
  selected,
  limit,
  unit,
  testIDPrefix,
  onSelect,
}: DurationDrumProps) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const selectedIndex = Math.max(0, Math.min(count - 1, selected));
  const restingIndex = useRef(selectedIndex);
  const isDragging = useRef(false);
  const scrollY = useSharedValue(selectedIndex * WHEEL_ROW_HEIGHT);
  const tickIndex = useSharedValue(selectedIndex);

  const glideTo = (index: number) => {
    scrollRef.current?.scrollTo({ y: index * WHEEL_ROW_HEIGHT, animated: true });
  };

  // Follows changes made elsewhere, like the hours drum pulling the minutes back under the cap.
  useEffect(() => {
    if (isDragging.current || selectedIndex === restingIndex.current) return;
    restingIndex.current = selectedIndex;
    scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ROW_HEIGHT, animated: true });
  }, [selectedIndex]);

  const commit = (index: number) => {
    if (index === restingIndex.current) return;
    restingIndex.current = index;
    onSelect(index);
  };

  const moveTo = (index: number) => {
    const allowed = Math.max(0, Math.min(index, limit));
    glideTo(allowed);
    commit(allowed);
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const index = wheelIndexAt(event.nativeEvent.contentOffset.y, count);
    const allowed = Math.min(index, limit);
    if (allowed !== index) glideTo(allowed);
    commit(allowed);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      const index = wheelIndexAt(event.contentOffset.y, count);
      if (index === tickIndex.get()) return;
      tickIndex.set(index);
      scheduleOnRN(tickHaptic);
    },
  });

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
    moveTo(restingIndex.current + step);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={unit}
      accessibilityValue={{ text: `${selectedIndex} ${unit}` }}
      accessibilityActions={ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={onAccessibilityAction}
      style={styles.drum}
      testID={`${testIDPrefix}-drum`}
    >
      <Animated.ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="normal"
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ROW_HEIGHT }}
        contentContainerStyle={styles.drumContent}
        style={{ height: WHEEL_HEIGHT }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          isDragging.current = true;
        }}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < RESTING_VELOCITY) settle(event);
        }}
        onMomentumScrollEnd={settle}
        testID={`${testIDPrefix}-scroll`}
      >
        {Array.from({ length: count }, (_, index) => (
          <DrumRow
            key={index}
            index={index}
            scrollY={scrollY}
            isDimmed={index > limit}
            testID={`${testIDPrefix}-${index}`}
            onPress={() => moveTo(index)}
          />
        ))}
      </Animated.ScrollView>
      <View style={styles.unitRow}>
        <View style={styles.unitDigitsSpace} />
        <Text style={styles.unit} numberOfLines={1}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

function DrumRow({
  index,
  scrollY,
  isDimmed,
  testID,
  onPress,
}: {
  index: number;
  scrollY: SharedValue<number>;
  isDimmed: boolean;
  testID: string;
  onPress: () => void;
}) {
  const poseStyle = useAnimatedStyle(() => {
    const pose = wheelRowPose(index - scrollY.get() / WHEEL_ROW_HEIGHT);
    return {
      opacity: pose.opacity,
      transform: [
        { perspective: 600 },
        { translateY: pose.translateY },
        { rotateX: `${pose.rotateX}rad` },
      ],
    };
  });

  return (
    <Pressable accessible={false} onPress={onPress} style={styles.row} testID={testID}>
      <Animated.View style={[styles.rowContent, poseStyle]}>
        <Text style={[styles.value, isDimmed && styles.valueDimmed]}>{index}</Text>
        <View style={styles.unitSpace} />
      </Animated.View>
    </Pressable>
  );
}
