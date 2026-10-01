import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  PracticeBranchChips,
  sessionTypeAccent,
} from "../../../components/session/SkillFocusChips";
import { focusesForBranch, type SkillBranch, type SkillFocusId } from "../../../constants/skills";
import { motion } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SkillProgressDto } from "../../../types/skillProgress";
import type { FocusReflectionSelection } from "../hooks/useFocusReflectionSelection";
import { styles } from "../sessionComplete.styles";
import { isFullPass } from "../skillFocusReflection";
import { AreaWeightControl, WorkedAreas } from "./ProductionAreaControls";
import { SkillFocusTile } from "./SkillFocusTile";

const PILL_HIT_SLOP = 6;

type ProgressBySkill = Partial<Record<SkillFocusId, SkillProgressDto>>;

type SkillFocusReflectionPickerProps = {
  selection: FocusReflectionSelection;
  /** Session length, for the production time split preview. */
  durationSeconds?: number;
  progressBySkill?: ProgressBySkill;
};

/**
 * Focus tiles per area with a full-pass toggle. Learning sessions pick an area first;
 * production sessions pick and weigh every area they went into.
 */
export function SkillFocusReflectionPicker({
  selection,
  durationSeconds = 0,
  progressBySkill = {},
}: SkillFocusReflectionPickerProps) {
  return (
    <>
      {selection.isLearning ? (
        <View style={styles.branchSection}>
          <PracticeBranchChips
            practiceBranch={selection.practiceBranch}
            onSelect={selection.selectPracticeBranch}
          />
        </View>
      ) : null}
      {selection.isProduction ? (
        <WorkedAreas selection={selection} durationSeconds={durationSeconds} />
      ) : null}
      {selection.visibleBranches.map((branch) => (
        <BranchSection
          key={branch}
          branch={branch}
          showTitle={selection.isProduction || selection.visibleBranches.length > 1}
          selection={selection}
          progressBySkill={progressBySkill}
        />
      ))}
    </>
  );
}

function BranchSection({
  branch,
  showTitle,
  selection,
  progressBySkill,
}: {
  branch: SkillBranch;
  showTitle: boolean;
  selection: FocusReflectionSelection;
  progressBySkill: ProgressBySkill;
}) {
  const accent = sessionTypeAccent(branch);
  const { focusIds, primaryFocusId } = selection.reflection;
  return (
    <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.branchSection}>
      <BranchHeader
        branch={branch}
        showTitle={showTitle}
        accent={accent}
        isActive={isFullPass(focusIds, branch)}
        onToggle={() => selection.toggleFullPass(branch)}
      />
      {selection.isProduction ? <AreaWeightControl branch={branch} selection={selection} /> : null}
      {pairsOf(focusesForBranch(branch).map(({ id }) => id)).map((pair) => (
        <View key={pair[0]} style={styles.tileRow}>
          {pair.map((id) => (
            <SkillFocusTile
              key={id}
              id={id}
              accent={accent}
              isSelected={focusIds.includes(id)}
              isMainFocus={primaryFocusId === id}
              progress={progressBySkill[id]}
              onToggle={selection.toggleFocus}
              onToggleMainFocus={selection.toggleMainFocus}
            />
          ))}
          {pair.length === 1 ? <View style={styles.tileSpacer} /> : null}
        </View>
      ))}
    </Animated.View>
  );
}

function BranchHeader({
  branch,
  showTitle,
  accent,
  isActive,
  onToggle,
}: {
  branch: SkillBranch;
  showTitle: boolean;
  accent: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const area = sessionTypeLabel(branch, t);
  return (
    <View style={styles.branchHeader}>
      {showTitle ? (
        <Text style={styles.branchTitle} accessibilityRole="header">
          {area}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isActive }}
        accessibilityHint={t("sessionComplete.fullPassHint", { area })}
        hitSlop={PILL_HIT_SLOP}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onToggle();
        }}
        testID={`full-pass-${branch}`}
        style={({ pressed }) => [
          styles.fullPassPill,
          isActive && { borderColor: accent, backgroundColor: `${accent}26` },
          pressed && styles.tilePressed,
        ]}
      >
        {isActive ? <Check size={14} color={accent} strokeWidth={3} /> : null}
        <Text style={[styles.fullPassText, isActive && styles.fullPassTextActive]}>
          {t("sessionComplete.fullPass")}
        </Text>
      </Pressable>
    </View>
  );
}

function pairsOf(ids: SkillFocusId[]): SkillFocusId[][] {
  const pairs: SkillFocusId[][] = [];
  for (let index = 0; index < ids.length; index += 2) pairs.push(ids.slice(index, index + 2));
  return pairs;
}
