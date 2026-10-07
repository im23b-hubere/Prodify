import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import type { SkillFocusId } from "../../../constants/skills";
import { colors, motion } from "../../../constants/theme";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SkillTimeAllocation } from "../focusTime";
import { ADD_NUDGE_PULSE, styles } from "../sessionComplete.styles";
import { formatCompactDuration } from "../skillProgressPresentation";

type WorkedOnListProps = {
  focusIds: readonly SkillFocusId[];
  assignedSeconds: SkillTimeAllocation;
  leveledToByFocus?: Partial<Record<SkillFocusId, number | null>>;
  canAdd: boolean;
  nudge?: boolean;
  onRemove: (id: SkillFocusId) => void;
  onAdd: () => void;
  onPressRow?: (id: SkillFocusId) => void;
};

/** Credited focuses for this session, minutes even-split until a row is spun. */
export function WorkedOnList({
  focusIds,
  assignedSeconds,
  leveledToByFocus = {},
  canAdd,
  nudge = false,
  onRemove,
  onAdd,
  onPressRow,
}: WorkedOnListProps) {
  return (
    <View style={styles.workedOnList}>
      {focusIds.map((id) => (
        <WorkedOnRow
          key={id}
          id={id}
          seconds={assignedSeconds[id] ?? 0}
          leveledTo={leveledToByFocus[id] ?? null}
          onRemove={() => onRemove(id)}
          onPress={onPressRow ? () => onPressRow(id) : undefined}
        />
      ))}
      {canAdd ? <AddFocusButton nudge={nudge} onAdd={onAdd} /> : null}
    </View>
  );
}

function AddFocusButton({ nudge, onAdd }: { nudge: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("sessionComplete.addFocus")}
      onPress={onAdd}
      style={({ pressed }) => [
        nudge ? styles.workedOnAddNudge : styles.workedOnAdd,
        pressed && styles.focusRetryPressed,
      ]}
      testID="worked-on-add"
    >
      <Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />
      <Text style={nudge ? styles.workedOnAddNudgeText : styles.workedOnAddText}>
        {t("sessionComplete.addFocus")}
      </Text>
    </Pressable>
  );

  if (!nudge) return button;

  return (
    <Animated.View
      testID="worked-on-nudge"
      style={reducedMotion ? undefined : ADD_NUDGE_PULSE}
    >
      {button}
    </Animated.View>
  );
}

function WorkedOnRow({
  id,
  seconds,
  leveledTo,
  onRemove,
  onPress,
}: {
  id: SkillFocusId;
  seconds: number;
  leveledTo: number | null;
  onRemove: () => void;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const name = skillFocusText(id, "short", t);

  useEffect(() => {
    if (leveledTo == null || reducedMotion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, [leveledTo, reducedMotion]);

  return (
    <Animated.View
      entering={FadeIn.duration(motion.quick)}
      exiting={FadeOut.duration(motion.quick)}
      style={styles.workedOnRow}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        disabled={!onPress}
        onPress={onPress}
        style={styles.workedOnRowMain}
        testID={`worked-on-${id}`}
      >
        <Text style={styles.workedOnName} numberOfLines={1}>
          {name}
        </Text>
        {leveledTo != null ? (
          <Animated.Text
            entering={FadeIn.duration(motion.quick)}
            style={styles.workedOnLevel}
            testID={`worked-on-level-${id}`}
          >
            {t("sessionComplete.progressLevel", { level: leveledTo })}
          </Animated.Text>
        ) : null}
        <Text style={styles.workedOnMinutes}>{formatCompactDuration(seconds)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("sessionComplete.removeFocus", { name })}
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [styles.workedOnRemove, pressed && styles.focusRetryPressed]}
        testID={`worked-on-remove-${id}`}
      >
        <Minus size={16} color={colors.textSecondary} strokeWidth={2.6} />
      </Pressable>
    </Animated.View>
  );
}
