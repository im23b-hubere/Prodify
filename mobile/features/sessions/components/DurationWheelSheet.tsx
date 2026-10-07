import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../constants/theme";
import {
  WHEEL_HEIGHT,
  WHEEL_ITEM_HEIGHT,
  WHEEL_VISIBLE_ROWS,
  wheelStyles as styles,
} from "../durationWheel.styles";
import {
  clampDurationMinutes,
  durationParts,
  showsHoursColumn,
} from "../durationWheel";

type DurationWheelSheetProps = {
  visible: boolean;
  title: string;
  totalMinutes: number;
  maxMinutes: number;
  onChange: (minutes: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

const PAD = Math.floor(WHEEL_VISIBLE_ROWS / 2);

/** Apple Clock-style duration drums: hours + minutes, or minutes only under an hour. */
export function DurationWheelSheet({
  visible,
  title,
  totalMinutes,
  maxMinutes,
  onChange,
  onSave,
  onCancel,
}: DurationWheelSheetProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const showHours = showsHoursColumn(maxMinutes);
  const { hours, minutes } = durationParts(clampDurationMinutes(totalMinutes, maxMinutes));
  const maxHours = Math.floor(maxMinutes / 60);
  const minuteValues = showHours ? range(0, 59) : range(0, maxMinutes);
  const hourValues = range(0, maxHours);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={onCancel}
          style={styles.dismissArea}
        />
        <SafeAreaView edges={["bottom"]} style={styles.sheet} testID="duration-wheel">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.headerSide}
              testID="duration-wheel-cancel"
            >
              <Text style={styles.headerAction}>{t("common.cancel")}</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onSave}
              style={[styles.headerSide, styles.headerSideEnd]}
              testID="duration-wheel-save"
            >
              <Text style={[styles.headerAction, styles.headerActionSave]}>{t("common.save")}</Text>
            </Pressable>
          </View>
          <View style={styles.stage}>
            <View style={styles.drums}>
              {showHours ? (
                <DurationDrum
                  values={hourValues}
                  selected={hours}
                  unit={t("sessionComplete.wheelHours")}
                  testIDPrefix="duration-wheel-hour"
                  reducedMotion={Boolean(reducedMotion)}
                  onSelect={(value) =>
                    onChange(clampDurationMinutes(value * 60 + minutes, maxMinutes))
                  }
                />
              ) : null}
              <DurationDrum
                values={minuteValues}
                selected={showHours ? minutes : clampDurationMinutes(totalMinutes, maxMinutes)}
                unit={t("sessionComplete.wheelMin")}
                testIDPrefix="duration-wheel-minute"
                reducedMotion={Boolean(reducedMotion)}
                onSelect={(value) =>
                  onChange(
                    clampDurationMinutes(showHours ? hours * 60 + value : value, maxMinutes),
                  )
                }
              />
              <LinearGradient
                colors={[colors.surface, "transparent"]}
                pointerEvents="none"
                style={[styles.fade, styles.fadeTop]}
              />
              <LinearGradient
                colors={["transparent", colors.surface]}
                pointerEvents="none"
                style={[styles.fade, styles.fadeBottom]}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DurationDrum({
  values,
  selected,
  unit,
  testIDPrefix,
  reducedMotion,
  onSelect,
}: {
  values: number[];
  selected: number;
  unit: string;
  testIDPrefix: string;
  reducedMotion: boolean;
  onSelect: (value: number) => void;
}) {
  const listRef = useRef<ScrollView>(null);
  const lastIndex = useRef(values.indexOf(selected));
  const settled = useRef(false);
  const selectedIndex = Math.max(0, values.indexOf(selected));

  useEffect(() => {
    lastIndex.current = selectedIndex;
    settled.current = false;
    listRef.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
    const frame = requestAnimationFrame(() => {
      settled.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);

  const emitIndex = (offsetY: number) => {
    if (!settled.current) return;
    const index = Math.max(
      0,
      Math.min(values.length - 1, Math.round(offsetY / WHEEL_ITEM_HEIGHT)),
    );
    const value = values[index];
    if (value == null || index === lastIndex.current) return;
    lastIndex.current = index;
    if (!reducedMotion) {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onSelect(value);
  };

  return (
    <View style={styles.drum}>
      <ScrollView
        ref={listRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={reducedMotion ? 0.92 : "fast"}
        disableIntervalMomentum
        onScroll={(event) => emitIndex(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(event) => emitIndex(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingVertical: PAD * WHEEL_ITEM_HEIGHT,
        }}
        style={{ height: WHEEL_HEIGHT }}
      >
        {values.map((value) => (
          <Pressable
            key={value}
            onPress={() => {
              lastIndex.current = values.indexOf(value);
              if (!reducedMotion) {
                Haptics.selectionAsync().catch(() => undefined);
              }
              onSelect(value);
            }}
            style={styles.drumItem}
            testID={`${testIDPrefix}-${value}`}
          >
            <Text style={styles.drumValue}>{value}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.selection}>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}
