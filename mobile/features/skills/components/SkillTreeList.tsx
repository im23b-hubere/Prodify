import { Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { SKILL_BRANCH_ICONS, SKILL_FOCUS_ICONS } from "../../../constants/skillIcons";
import { SKILL_BRANCHES, focusesForBranch, type SkillFocusId } from "../../../constants/skills";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import { formatCompactDuration } from "../../sessions/skillProgressPresentation";
import { LOCKED_ICON_COLOR, LOCKED_NODE_FILL, styles } from "../skillTree.styles";
import type { SkillNodeState, SkillTreeModel } from "../skillTreePresentation";

type SkillTreeListProps = {
  model: SkillTreeModel;
  topInset: number;
  bottomInset: number;
  onShowFocus: (id: SkillFocusId) => void;
};

/** The tree as plain rows: easier with a screen reader and for a quick overview. */
export function SkillTreeList({ model, topInset, bottomInset, onShowFocus }: SkillTreeListProps) {
  const { t } = useTranslation();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.listContent,
        { paddingTop: topInset, paddingBottom: bottomInset },
      ]}
      testID="skill-tree-list"
    >
      {SKILL_BRANCHES.map((branch) => {
        const state = model.branches[branch];
        const accent = sessionTypeAccent(branch);
        const BranchIcon = state.isUnlocked ? SKILL_BRANCH_ICONS[branch] : Lock;
        return (
          <View key={branch} style={styles.listBranch}>
            <View style={styles.listRow} accessibilityRole="header">
              <RowIcon isUnlocked={state.isUnlocked} accent={accent}>
                <BranchIcon size={18} color={state.isUnlocked ? accent : LOCKED_ICON_COLOR} />
              </RowIcon>
              <Text style={styles.listBranchTitle}>{sessionTypeLabel(branch, t)}</Text>
              <Text style={styles.listRowMeta}>{levelText(state, t)}</Text>
            </View>
            {state.isUnlocked ? <ThinBar accent={accent} fraction={state.levelFraction} /> : null}
            {focusesForBranch(branch).map(({ id }) => (
              <FocusRow key={id} id={id} state={model.focuses[id]} accent={accent} onPress={onShowFocus} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function FocusRow({
  id,
  state,
  accent,
  onPress,
}: {
  id: SkillFocusId;
  state: SkillNodeState;
  accent: string;
  onPress: (id: SkillFocusId) => void;
}) {
  const { t } = useTranslation();
  const Icon = state.isUnlocked ? SKILL_FOCUS_ICONS[id] : Lock;
  const name = skillFocusText(id, "label", t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        state.isUnlocked
          ? t("skillTree.nodeAccessibility", { name, level: state.level })
          : t("skillTree.nodeLockedAccessibility", { name })
      }
      accessibilityHint={skillFocusText(id, "covers", t)}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
      testID={`skill-tree-row-${id}`}
    >
      <RowIcon isUnlocked={state.isUnlocked} accent={accent}>
        <Icon size={16} color={state.isUnlocked ? accent : LOCKED_ICON_COLOR} />
      </RowIcon>
      <Text style={[styles.listRowName, !state.isUnlocked && styles.listRowNameLocked]}>{name}</Text>
      <Text style={styles.listRowMeta}>
        {state.isUnlocked
          ? `${formatCompactDuration(state.totalSeconds)} · ${levelText(state, t)}`
          : levelText(state, t)}
      </Text>
    </Pressable>
  );
}

function RowIcon({
  isUnlocked,
  accent,
  children,
}: {
  isUnlocked: boolean;
  accent: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.listRowIcon, { backgroundColor: isUnlocked ? `${accent}24` : LOCKED_NODE_FILL }]}>
      {children}
    </View>
  );
}

export function ThinBar({ accent, fraction }: { accent: string; fraction: number }) {
  return (
    <View style={styles.thinTrack}>
      <View
        style={[styles.thinFill, { backgroundColor: accent, width: `${Math.round(fraction * 100)}%` }]}
      />
    </View>
  );
}

function levelText(state: SkillNodeState, t: ReturnType<typeof useTranslation>["t"]): string {
  return state.isUnlocked ? t("skillTree.level", { level: state.level }) : t("skillTree.locked");
}
