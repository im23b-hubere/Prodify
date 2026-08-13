import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { LevelRankRow } from "../../../components/progression/LevelRankRow";
import { AppCard } from "../../../components/ui/AppCard";
import type { ProgressionLevelItem } from "../../../lib/progressionLevelCatalog";
import type { LevelTierTheme } from "../../../lib/progressionLevelTheme";
import { styles } from "../progressionOverview.styles";

type TierGroups = { tier: LevelTierTheme; levels: ProgressionLevelItem[] }[];
type Props = { groups: TierGroups; currentLevel: number; visible: boolean };

export function ProgressionRankCatalog({ groups, currentLevel, visible }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <AppCard>
      <Text style={styles.levelTitle}>{t("progression.allLevelsTitle")}</Text>
      <View style={styles.tierSections}>
        {groups.map(({ tier, levels }) => (
          <View key={tier.id} style={styles.tierSection}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierDot, { backgroundColor: tier.accent }]} />
              <Text style={[styles.tierHeaderText, { color: tier.accent }]}>
                {t(tier.labelKey)}
              </Text>
              <View style={[styles.tierLine, { backgroundColor: tier.accentSoft }]} />
            </View>
            <View style={styles.levelRows}>
              {levels.map((entry) => (
                <LevelRankRow key={entry.level} entry={entry} currentLevel={currentLevel} t={t} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}
