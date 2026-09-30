import { Lock, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { SKILL_BRANCH_ICONS, SKILL_FOCUS_ICONS } from "../../../constants/skillIcons";
import {
  SKILL_BRANCHES,
  branchOfFocus,
  focusesForBranch,
  isSkillBranch,
  type SkillBranch,
  type SkillFocusId,
} from "../../../constants/skills";
import { colors, motion } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import { SkillProgressBar } from "../../sessions/components/SkillProgressBar";
import { formatCompactDuration } from "../../sessions/skillProgressPresentation";
import type { SkillTreeNodeId } from "../hooks/useSkillTreeScreen";
import { LOCKED_ICON_COLOR, LOCKED_NODE_FILL, styles } from "../skillTree.styles";
import { daysSince, type SkillNodeState, type SkillTreeModel } from "../skillTreePresentation";

type SkillNodeDetailCardProps = {
  nodeId: SkillTreeNodeId;
  model: SkillTreeModel;
  onClose: () => void;
};

export function SkillNodeDetailCard({ nodeId, model, onClose }: SkillNodeDetailCardProps) {
  return (
    <Animated.View
      key={nodeId}
      entering={FadeInDown.duration(motion.standard)}
      exiting={FadeOut.duration(motion.quick)}
      style={styles.card}
      testID="skill-tree-detail"
      accessibilityLiveRegion="polite"
    >
      {nodeId === "center" ? (
        <CenterDetail model={model} onClose={onClose} />
      ) : isSkillBranch(nodeId) ? (
        <BranchDetail branch={nodeId} model={model} onClose={onClose} />
      ) : (
        <FocusDetail focusId={nodeId} state={model.focuses[nodeId]} onClose={onClose} />
      )}
    </Animated.View>
  );
}

function CenterDetail({ model, onClose }: { model: SkillTreeModel; onClose: () => void }) {
  const { t } = useTranslation();
  const unlockedAreas = SKILL_BRANCHES.filter((branch) => model.branches[branch].isUnlocked);
  return (
    <>
      <CardHeader
        eyebrow={t("skillTree.you")}
        title={t("skillTree.centerTitle")}
        accent={colors.primary}
        onClose={onClose}
      />
      <Text style={styles.cardBody}>
        {t("skillTree.centerBody", {
          unlocked: model.unlockedFocusCount,
          total: model.focusCount,
          areas: unlockedAreas.length,
        })}
      </Text>
      <Text style={styles.cardMeta}>
        {t("skillTree.trained", { time: formatCompactDuration(model.totalSeconds) })}
      </Text>
    </>
  );
}

function BranchDetail({
  branch,
  model,
  onClose,
}: {
  branch: SkillBranch;
  model: SkillTreeModel;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const state = model.branches[branch];
  const accent = sessionTypeAccent(branch);
  const focuses = focusesForBranch(branch);
  const unlocked = focuses.filter(({ id }) => model.focuses[id].isUnlocked).length;
  const area = sessionTypeLabel(branch, t);
  return (
    <>
      <CardHeader
        eyebrow={t("skillTree.branchFocuses", { unlocked, total: focuses.length })}
        title={area}
        accent={accent}
        Icon={SKILL_BRANCH_ICONS[branch]}
        isUnlocked={state.isUnlocked}
        onClose={onClose}
      />
      {state.isUnlocked ? (
        <LevelProgress state={state} accent={accent} />
      ) : (
        <Text style={styles.cardBody}>{t("skillTree.lockedBranchHint", { area })}</Text>
      )}
    </>
  );
}

function FocusDetail({
  focusId,
  state,
  onClose,
}: {
  focusId: SkillFocusId;
  state: SkillNodeState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const branch = branchOfFocus(focusId);
  const accent = sessionTypeAccent(branch);
  return (
    <>
      <CardHeader
        eyebrow={sessionTypeLabel(branch, t)}
        title={skillFocusText(focusId, "label", t)}
        accent={accent}
        Icon={SKILL_FOCUS_ICONS[focusId]}
        isUnlocked={state.isUnlocked}
        onClose={onClose}
      />
      {state.isUnlocked ? (
        <LevelProgress state={state} accent={accent} />
      ) : (
        <Text style={styles.cardMeta}>{t("skillTree.lockedFocusHint")}</Text>
      )}
      <Text style={styles.cardBody}>{skillFocusText(focusId, "covers", t)}</Text>
    </>
  );
}

function LevelProgress({ state, accent }: { state: SkillNodeState; accent: string }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.cardLevelRow}>
        <Text style={styles.cardLevel}>{t("skillTree.levelLong", { level: state.level })}</Text>
        <Text style={styles.cardMeta}>
          {state.secondsToNextLevel === null
            ? t("skillTree.topLevel")
            : t("skillTree.toNextLevel", {
                time: formatCompactDuration(state.secondsToNextLevel),
                level: state.level + 1,
              })}
        </Text>
      </View>
      <SkillProgressBar accent={accent} fromFraction={0} toFraction={state.levelFraction} />
      <Text style={styles.cardMeta}>
        {[
          t("skillTree.trained", { time: formatCompactDuration(state.totalSeconds) }),
          t("skillTree.sessionCount", { count: state.sessionCount }),
          lastTrainedText(state.lastTrainedAt, t),
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </>
  );
}

function lastTrainedText(
  lastTrainedAt: string | null,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (!lastTrainedAt) return null;
  const days = daysSince(lastTrainedAt, new Date());
  return days === 0 ? t("skillTree.lastTrainedToday") : t("skillTree.lastTrained", { count: days });
}

function CardHeader({
  eyebrow,
  title,
  accent,
  Icon,
  isUnlocked = true,
  onClose,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  Icon?: (typeof SKILL_BRANCH_ICONS)[SkillBranch];
  isUnlocked?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const IconComponent = isUnlocked ? Icon : Lock;
  return (
    <View style={styles.cardHeader}>
      {IconComponent ? (
        <View
          style={[
            styles.cardIcon,
            { backgroundColor: isUnlocked ? `${accent}24` : LOCKED_NODE_FILL },
          ]}
        >
          <IconComponent size={22} color={isUnlocked ? accent : LOCKED_ICON_COLOR} />
        </View>
      ) : null}
      <View style={styles.cardTitleWrap}>
        <Text style={[styles.cardEyebrow, { color: isUnlocked ? accent : colors.textSecondary }]}>
          {eyebrow}
        </Text>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("skillTree.close")}
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        testID="skill-tree-detail-close"
      >
        <X size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
