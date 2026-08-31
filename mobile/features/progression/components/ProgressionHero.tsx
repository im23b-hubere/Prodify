import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { LevelRankHeroEmblem } from "../../../components/progression/LevelRankHero";
import { AppCard } from "../../../components/ui/AppCard";
import { progressionLevelName } from "../../../lib/progressionLevels";
import { levelTierFor } from "../../../lib/progressionLevelTheme";
import type { ProgressionDto } from "../../../types/outcomes";
import { styles } from "../progressionOverview.styles";

type Props = { progression: ProgressionDto | null; loadError: string | null };

export function ProgressionHero({ progression, loadError }: Props) {
  if (!progression || loadError) return null;
  return <ProgressionHeroReady progression={progression} />;
}

function ProgressionHeroReady({ progression }: { progression: ProgressionDto }) {
  const { t } = useTranslation();
  const level = progression.current_level;
  const rankName = useMemo(() => progressionLevelName(t, level), [level, t]);
  const nextRankName = useMemo(() => progressionLevelName(t, level + 1), [level, t]);
  const tier = useMemo(() => levelTierFor(level), [level]);
  const percent = Math.max(0, Math.min(100, progression.progress_percent));

  return (
    <AppCard
      style={[styles.heroCard, { borderColor: tier.accentSoft }]}
      testID="progression-hero-ready"
    >
      <LevelRankHeroEmblem level={level} t={t} />
      <Text style={styles.metaLine} testID="progression-hero-xp-total">
        {t("progression.xpTotal", { xp: progression.xp_total })}
      </Text>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        accessibilityLabel={t("progression.progressBarA11y", {
          name: rankName,
          percent: Math.round(percent),
          xp: progression.xp_to_next_level,
          nextName: nextRankName,
        })}
      >
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: tier.accent }]} />
      </View>
      <Text style={styles.metaLine} testID="progression-hero-to-next">
        {t("progression.toNext", {
          xp: progression.xp_to_next_level,
          nextName: nextRankName,
          percent: Math.round(percent),
        })}
      </Text>
      <Text style={styles.hint}>{t("progression.overviewHint")}</Text>
      <Text style={styles.decayHint}>{t("progression.decayRule")}</Text>
    </AppCard>
  );
}
