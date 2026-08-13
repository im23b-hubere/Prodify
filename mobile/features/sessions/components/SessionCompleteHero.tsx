import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { StatTile } from "../../../components/ui/StatTile";
import { progressionLevelName } from "../../../lib/progressionLevels";
import { sessionMoodLabel, sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords } from "../../../lib/sessionTime";
import type { SessionCompleteController } from "../hooks/useSessionCompleteController";
import { styles } from "../sessionComplete.styles";
import {
  MINIMUM_COUNTED_SESSION_MINUTES,
  sessionHighlightKey,
  shortenSessionLabel,
} from "../sessionCompletePresentation";

export function SessionCompleteHero({ controller }: { controller: SessionCompleteController }) {
  const { t, session, progression, streak, xpGainEstimate } = controller;
  const moodLabel = session?.mood_level != null ? sessionMoodLabel(session.mood_level, t) : null;
  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0a0a0a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <Text style={styles.heroEyebrow}>{t("sessionComplete.heroEyebrow")}</Text>
      <Text style={styles.bigDur}>{formatDurationWords(controller.durationSeconds)}</Text>
      <View style={styles.metaRow}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>
            {sessionTypeLabel(session?.session_type ?? "beat_making", t)}
          </Text>
        </View>
        {moodLabel ? (
          <View style={styles.moodPill}>
            <Text style={styles.moodPillText}>{moodLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.statGrid}>
        <StatTile
          label={t("sessionComplete.statXpLabel")}
          value={`+${xpGainEstimate}`}
          accent={xpGainEstimate > 0}
        />
        {streak !== null && streak > 0 ? (
          <StatTile
            label={t("sessionComplete.statStreakLabel")}
            value={`${streak}d`}
            icon="flame"
          />
        ) : null}
        {progression ? (
          <StatTile
            label={t("sessionComplete.statLevelLabel")}
            value={`${progression.current_level}`}
          />
        ) : null}
      </View>
      <ProgressHint controller={controller} />
      <Text style={styles.punchline}>{t(sessionHighlightKey(controller.feedback))}</Text>
    </LinearGradient>
  );
}

function ProgressHint({ controller }: { controller: SessionCompleteController }) {
  const { t, progression, xpGainEstimate } = controller;
  if (xpGainEstimate === 0)
    return (
      <Text style={styles.xpHintInline}>
        {t("sessionComplete.xpMinDurationHint", { min: MINIMUM_COUNTED_SESSION_MINUTES })}
      </Text>
    );
  if (!progression) return null;
  return (
    <Text style={styles.levelLine}>
      {t("sessionComplete.levelProgress", {
        name: shortenSessionLabel(progressionLevelName(t, progression.current_level)),
        toNext: progression.xp_to_next_level,
        nextName: shortenSessionLabel(progressionLevelName(t, progression.current_level + 1)),
      })}
    </Text>
  );
}
