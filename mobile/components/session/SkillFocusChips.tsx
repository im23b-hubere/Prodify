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

/** Focus chips for a session type; learning sessions pick a practice area first. */
export function SkillFocusChips({
  sessionType,
  fields,
  showPracticePrompts = false,
}: SkillFocusChipsProps) {
  const isLearning = sessionType === "learning";
  const branches = isLearning
    ? fields.practiceBranch
      ? [fields.practiceBranch]
      : []
    : skillBranchesForSessionType(sessionType);

  return (
    <>
      {isLearning ? (
        <PracticeBranchChips
          practiceBranch={fields.practiceBranch}
          onSelect={fields.selectPracticeBranch}
        />
      ) : null}
      {branches.map((branch) => (
        <FocusGroup
          key={branch}
          branch={branch}
          showTitle={branches.length > 1}
          fields={fields}
        />
      ))}
      {isLearning && showPracticePrompts ? <PracticePrompts focusIds={fields.focusIds} /> : null}
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
    <View style={styles.focusGroup}>
      <Text style={styles.focusGroupTitle}>{t("sessionSetup.practiceAreaPrompt")}</Text>
      <View style={styles.focusChipRow} accessibilityRole="radiogroup">
        {SKILL_BRANCHES.map((branch) => (
          <Chip
            key={branch}
            role="radio"
            label={sessionTypeLabel(branch, t)}
            accent={sessionTypeAccent(branch)}
            selected={practiceBranch === branch}
            onPress={() => onSelect(branch)}
            testID={`practice-branch-${branch}`}
          />
        ))}
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
