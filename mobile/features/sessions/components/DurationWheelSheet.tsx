import { Check, X } from "lucide-react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PressableScale } from "../../../components/ui/PressableScale";
import { SwipeSheet } from "../../../components/ui/SwipeSheet";
import { colors } from "../../../constants/theme";
import {
  clampDurationMinutes,
  durationParts,
  minuteLimit,
  showsHoursColumn,
} from "../durationWheel";
import { WHEEL_SHEET_HEIGHT, wheelStyles as styles } from "../durationWheel.styles";
import { DurationDrum } from "./DurationDrum";

type DurationWheelSheetProps = {
  visible: boolean;
  title: string;
  totalMinutes: number;
  maxMinutes: number;
  onChange: (minutes: number) => void;
  /** Called once the sheet has slid away after the check mark. */
  onSave: () => void;
  /** Called once the sheet has slid away after the X, a swipe down or a backdrop tap. */
  onCancel: () => void;
};

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
  const isSaving = useRef(false);
  const showHours = showsHoursColumn(maxMinutes);
  const total = clampDurationMinutes(totalMinutes, maxMinutes);
  const { hours, minutes } = durationParts(total);

  return (
    <SwipeSheet
      visible={visible}
      onClose={() => (isSaving.current ? onSave() : onCancel())}
      closeLabel={t("common.cancel")}
      dragAnywhere={false}
      height={WHEEL_SHEET_HEIGHT}
      testID="duration-wheel"
      header={(close) => (
        <View style={styles.header}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={close}
            style={[styles.headerButton, styles.cancelButton]}
            testID="duration-wheel-cancel"
          >
            <X color={colors.textPrimary} size={20} strokeWidth={2.5} />
          </PressableScale>
          <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
            onPress={() => {
              isSaving.current = true;
              close();
            }}
            style={[styles.headerButton, styles.saveButton]}
            testID="duration-wheel-save"
          >
            <Check color={colors.textPrimary} size={20} strokeWidth={3} />
          </PressableScale>
        </View>
      )}
    >
      <View style={styles.drums}>
        <View style={styles.selectionBand} />
        {showHours ? (
          <DurationDrum
            count={Math.floor(maxMinutes / 60) + 1}
            selected={hours}
            limit={Math.floor(maxMinutes / 60)}
            unit={t("sessionComplete.wheelHours")}
            testIDPrefix="duration-wheel-hour"
            onSelect={(value) => onChange(clampDurationMinutes(value * 60 + minutes, maxMinutes))}
          />
        ) : null}
        <DurationDrum
          count={showHours ? 60 : maxMinutes + 1}
          selected={minutes}
          limit={minuteLimit(hours, maxMinutes)}
          unit={t("sessionComplete.wheelMin")}
          testIDPrefix="duration-wheel-minute"
          onSelect={(value) => onChange(hours * 60 + value)}
        />
      </View>
    </SwipeSheet>
  );
}
