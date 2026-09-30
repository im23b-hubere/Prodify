import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Star } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
} from "react-native";

import { SKILL_FOCUS_ICONS } from "../../../constants/skillIcons";
import type { SkillFocusId } from "../../../constants/skills";
import { colors } from "../../../constants/theme";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SkillProgressDto } from "../../../types/skillProgress";
import { styles } from "../sessionComplete.styles";
import {
  formatCompactDuration,
  skillProgressView,
  type SkillProgressView,
} from "../skillProgressPresentation";
import { SkillProgressBar } from "./SkillProgressBar";

const STAR_HIT_SLOP = 6;
const MAIN_FOCUS_ACTION = "mainFocus";

type SkillFocusTileProps = {
  id: SkillFocusId;
  accent: string;
  isSelected: boolean;
  isMainFocus: boolean;
  progress: SkillProgressDto | undefined;
  onToggle: (id: SkillFocusId) => void;
  onToggleMainFocus: (id: SkillFocusId) => void;
};

export function SkillFocusTile({
  id,
  accent,
  isSelected,
  isMainFocus,
  progress,
  onToggle,
  onToggleMainFocus,
}: SkillFocusTileProps) {
  const { t } = useTranslation();
  const Icon = SKILL_FOCUS_ICONS[id];
  const toggle = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onToggle(id);
  };
  const toggleMainFocus = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onToggleMainFocus(id);
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === MAIN_FOCUS_ACTION) toggleMainFocus();
    else toggle();
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={skillFocusText(id, "label", t)}
      accessibilityHint={skillFocusText(id, "covers", t)}
      accessibilityValue={isMainFocus ? { text: t("sessionComplete.mainFocus") } : undefined}
      accessibilityActions={[
        { name: "activate" },
        { name: MAIN_FOCUS_ACTION, label: t("sessionComplete.markMainFocus") },
      ]}
      onAccessibilityAction={onAccessibilityAction}
      onPress={toggle}
      testID={`skill-focus-${id}`}
      style={({ pressed }) => [
        styles.tile,
        isSelected && { borderColor: accent, backgroundColor: `${accent}1A` },
        pressed && styles.tilePressed,
      ]}
    >
      <View style={styles.tileTopRow}>
        <View style={[styles.tileIcon, isSelected && { backgroundColor: `${accent}33` }]}>
          <Icon size={17} color={isSelected ? accent : colors.textSecondary} strokeWidth={2.2} />
        </View>
        {isSelected ? (
          <Pressable
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            hitSlop={STAR_HIT_SLOP}
            onPress={toggleMainFocus}
            style={styles.starButton}
            testID={`skill-focus-star-${id}`}
          >
            <Star
              size={18}
              color={isMainFocus ? accent : colors.textSecondary}
              fill={isMainFocus ? accent : "transparent"}
              strokeWidth={2.2}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {skillFocusText(id, "short", t)}
      </Text>
      <Text style={styles.tileCovers} numberOfLines={2}>
        {skillFocusText(id, "covers", t)}
      </Text>
      {isSelected && progress ? (
        <TileProgress accent={accent} view={skillProgressView(progress)} />
      ) : null}
    </Pressable>
  );
}

function TileProgress({ accent, view }: { accent: string; view: SkillProgressView }) {
  const { t } = useTranslation();
  useLevelUpHaptic(view.isLevelUp);
  return (
    <View
      style={styles.tileProgress}
      accessible
      accessibilityLabel={t("sessionComplete.progressAccessibility", {
        minutes: view.gainedMinutes,
        level: view.level,
      })}
    >
      <View style={styles.progressRow}>
        {view.gainedMinutes > 0 ? (
          <Text style={[styles.progressGained, { color: accent }]}>
            {t("sessionComplete.progressGained", { minutes: view.gainedMinutes })}
          </Text>
        ) : null}
        <Text style={styles.progressLevel}>
          {t("sessionComplete.progressLevel", { level: view.level })}
        </Text>
      </View>
      <SkillProgressBar
        accent={accent}
        fromFraction={view.fromFraction}
        toFraction={view.toFraction}
      />
      <Text
        style={[styles.progressCaption, view.isLevelUp && styles.progressCaptionLevelUp]}
        numberOfLines={1}
      >
        {progressCaption(view, t)}
      </Text>
    </View>
  );
}

function progressCaption(view: SkillProgressView, t: TFunction) {
  if (view.isLevelUp) return t("sessionComplete.progressLevelUp", { level: view.level });
  if (view.secondsToNextLevel === null) return t("sessionComplete.progressTopLevel");
  return t("sessionComplete.progressToNext", {
    time: formatCompactDuration(view.secondsToNextLevel),
    level: view.level + 1,
  });
}

function useLevelUpHaptic(isLevelUp: boolean) {
  useEffect(() => {
    if (!isLevelUp) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [isLevelUp]);
}
