import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { StatsSection } from "../../stats/components/StatsSection";
import type { SkillProfileState } from "../hooks/useSkillProfile";
import { styles } from "../skillTree.styles";
import {
  buildSkillTreeModel,
  strongestBranches,
  type SkillTreeModel,
} from "../skillTreePresentation";
import { SkillTreeMiniMap } from "./SkillTreeMiniMap";
import { ThinBar } from "./SkillTreeList";

const MINI_MAP_SIZE = 112;
const STRONGEST_BRANCH_COUNT = 3;

export function SkillTreeSection({ skillProfile }: { skillProfile: SkillProfileState }) {
  const { t } = useTranslation();
  const { push } = useRouter();
  const model = buildSkillTreeModel(skillProfile.profile);
  const isReady = skillProfile.profile !== null;

  return (
    <StatsSection
      title={t("skillTree.title")}
      subtitle={
        isReady
          ? t("skillTree.sectionSubtitle", {
              unlocked: model.unlockedFocusCount,
              total: model.focusCount,
            })
          : null
      }
      testID="stats-skill-tree"
      pressable={
        !isReady && skillProfile.loadState === "error"
          ? undefined
          : {
              accessibilityLabel: t("skillTree.openTree"),
              accessibilityHint: t("skillTree.openTreeHint"),
              testID: "stats-skill-tree-open",
              onPress: () => push("/skill-tree"),
            }
      }
    >
      {!isReady && skillProfile.loadState === "error" ? (
        <View style={styles.sectionError} accessibilityLiveRegion="polite">
          <Text style={styles.sectionEmpty}>{t("skillTree.loadError")}</Text>
          <Pressable accessibilityRole="button" onPress={skillProfile.retry} hitSlop={8}>
            <Text style={styles.sectionRetry}>{t("skillTree.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sectionBody}>
          <SkillTreeMiniMap model={model} size={MINI_MAP_SIZE} />
          <SectionBranches model={model} isReady={isReady} />
        </View>
      )}
    </StatsSection>
  );
}

function SectionBranches({ model, isReady }: { model: SkillTreeModel; isReady: boolean }) {
  const { t } = useTranslation();
  if (!isReady) {
    return (
      <View style={styles.sectionBranches}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={[styles.sectionPlaceholderBar, { width: `${90 - index * 15}%` }]} />
        ))}
      </View>
    );
  }
  const branches = strongestBranches(model, STRONGEST_BRANCH_COUNT);
  if (branches.length === 0) {
    return <Text style={styles.sectionEmpty}>{t("skillTree.emptyBody")}</Text>;
  }
  return (
    <View style={styles.sectionBranches}>
      <Text style={styles.sectionBranchesLabel}>{t("skillTree.topAreas")}</Text>
      {branches.map((branch) => {
        const state = model.branches[branch];
        const accent = sessionTypeAccent(branch);
        return (
          <View key={branch} style={styles.sectionBranchRow}>
            <View style={styles.sectionBranchTop}>
              <Text style={styles.sectionBranchName} numberOfLines={1}>
                {sessionTypeLabel(branch, t)}
              </Text>
              <Text style={[styles.sectionBranchLevel, { color: accent }]}>
                {t("skillTree.level", { level: state.level })}
              </Text>
            </View>
            <ThinBar accent={accent} fraction={state.levelFraction} />
          </View>
        );
      })}
    </View>
  );
}
