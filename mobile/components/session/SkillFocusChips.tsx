import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { SESSION_TYPES, type SessionType } from "../../constants/sessionTypes";
import {
  SKILL_BRANCHES,
  branchOfFocus,
  focusesForBranch,
  skillBranchesForSessionType,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import { colors, motion } from "../../constants/theme";
import type { SkillFocusFields } from "../../features/sessions/hooks/useSkillFocusFields";
import { browsesAreas, focusesInBranch } from "../../features/sessions/skillFocusSelection";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { skillFocusText } from "../../lib/skillI18n";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";

const CHIP_HIT_SLOP = 4;

type SkillFocusChipsProps = {
  sessionType: SessionType;
  fields: SkillFocusFields;
  showPracticePrompts?: boolean;
};

export function sessionTypeAccent(sessionType: SessionType): string {
  return SESSION_TYPES.find((type) => type.id === sessionType)?.color ?? colors.primary;
}

/** Focus chips for a session type; learning and production sessions browse one area at a time. */
export function SkillFocusChips({
  sessionType,
  fields,
  showPracticePrompts = false,
}: SkillFocusChipsProps) {
  const { t } = useTranslation();
  const isBrowsingAreas = browsesAreas(sessionType);
  const isProduction = sessionType === "production";
  const branches = isBrowsingAreas
    ? fields.practiceBranch
      ? [fields.practiceBranch]
      : []
    : skillBranchesForSessionType(sessionType);

  return (
    <>
      {isBrowsingAreas ? (
        <AreaChips
          prompt={
            isProduction
              ? t("sessionSetup.productionAreaPrompt")
              : t("sessionSetup.practiceAreaPrompt")
          }
          role="radio"
          isSelected={(branch) => fields.practiceBranch === branch}
          onPress={fields.selectPracticeBranch}
          pickCount={
            isProduction ? (branch) => focusesInBranch(fields.focusIds, branch).length : undefined
          }
          testIDPrefix="practice-branch"
        />
      ) : null}
      {branches.map((branch) => (
        <FocusGroup key={branch} branch={branch} showTitle={branches.length > 1} fields={fields} />
      ))}
      {sessionType === "learning" && showPracticePrompts ? (
        <PracticePrompts focusIds={fields.focusIds} />
      ) : null}
    </>
  );
}

export function PracticeBranchChips({
  practiceBranch,
  onSelect,
}: {
  practiceBranch: SkillBranch | null;
  onSelect: (branch: SkillBranch) => void;
}) {
  const { t } = useTranslation();
  return (
    <AreaChips
      prompt={t("sessionSetup.practiceAreaPrompt")}
      role="radio"
      isSelected={(branch) => practiceBranch === branch}
      onPress={onSelect}
      testIDPrefix="practice-branch"
    />
  );
}

type AreaChipsProps = {
  prompt: string;
  role: "checkbox" | "radio";
  isSelected: (branch: SkillBranch) => boolean;
  onPress: (branch: SkillBranch) => void;
  /** Shows how many focuses are picked in each area, for selections spanning areas. */
  pickCount?: (branch: SkillBranch) => number;
  testIDPrefix: string;
};

export function AreaChips({
  prompt,
  role,
  isSelected,
  onPress,
  pickCount,
  testIDPrefix,
}: AreaChipsProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.focusGroup}>
      <Text style={styles.focusGroupTitle}>{prompt}</Text>
      <View
        style={styles.focusChipRow}
        accessibilityRole={role === "radio" ? "radiogroup" : undefined}
      >
        {SKILL_BRANCHES.map((branch) => {
          const area = sessionTypeLabel(branch, t);
          const count = pickCount?.(branch) ?? 0;
          return (
            <Chip
              key={branch}
              role={role}
              label={count > 0 ? `${area} · ${count}` : area}
              accessibilityLabel={count > 0 ? t("sessionSetup.areaPicked", { area, count }) : area}
              accent={sessionTypeAccent(branch)}
              selected={isSelected(branch)}
              onPress={() => onPress(branch)}
              testID={`${testIDPrefix}-${branch}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function FocusGroup({
  branch,
  showTitle,
  fields,
}: {
  branch: SkillBranch;
  showTitle: boolean;
  fields: SkillFocusFields;
}) {
  const { t } = useTranslation();
  const accent = sessionTypeAccent(branch);
  return (
    <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.focusGroup}>
      {showTitle ? <Text style={styles.focusGroupTitle}>{sessionTypeLabel(branch, t)}</Text> : null}
      <View style={styles.focusChipRow}>
        {focusesForBranch(branch).map(({ id }) => {
          const selected = fields.focusIds.includes(id);
          return (
            <Chip
              key={id}
              role="checkbox"
              label={skillFocusText(id, "short", t)}
              accessibilityLabel={skillFocusText(id, "label", t)}
              accessibilityHint={skillFocusText(id, "description", t)}
              accent={accent}
              selected={selected}
              disabled={!selected && fields.isFocusSelectionFull}
              onPress={() => fields.toggleFocus(id)}
              testID={`skill-focus-${id}`}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function PracticePrompts({ focusIds }: { focusIds: SkillFocusId[] }) {
  const { t } = useTranslation();
  return (
    <>
      {focusIds.map((id) => (
        <Animated.View
          key={id}
          entering={FadeIn.duration(motion.standard)}
          style={[styles.practiceCard, { borderLeftColor: sessionTypeAccent(branchOfFocus(id)) }]}
        >
          <Text style={styles.practiceCardLabel}>
            {t("sessionSetup.practiceTryThis", { focus: skillFocusText(id, "label", t) })}
          </Text>
          <Text style={styles.practiceCardText}>{skillFocusText(id, "practice", t)}</Text>
        </Animated.View>
      ))}
    </>
  );
}

type ChipProps = {
  role: "checkbox" | "radio";
  label: string;
  accent: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID: string;
};

function Chip({
  role,
  label,
  accent,
  selected,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  testID,
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.focusChip,
        selected && { borderColor: accent, backgroundColor: `${accent}26` },
        disabled && styles.focusChipDisabled,
        pressed && styles.focusChipPressed,
      ]}
    >
      <Text style={[styles.focusChipText, selected && styles.focusChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}
