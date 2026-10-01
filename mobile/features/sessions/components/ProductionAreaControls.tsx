import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AreaChips, sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { AREA_WEIGHTS, type AreaWeight, type SkillBranch } from "../../../constants/skills";
import { motion } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { areaTimeSplit, reflectedAreas, weightOfArea } from "../areaWeights";
import type { FocusReflectionSelection } from "../hooks/useFocusReflectionSelection";
import { styles } from "../sessionComplete.styles";
import { formatCompactDuration } from "../skillProgressPresentation";

const SEGMENT_HIT_SLOP = 4;

const WEIGHT_LABEL_KEYS = {
  1: "sessionComplete.areaWeightLittle",
  2: "sessionComplete.areaWeightSome",
  3: "sessionComplete.areaWeightLot",
} as const satisfies Record<AreaWeight, string>;

type WorkedAreasProps = {
  selection: FocusReflectionSelection;
  durationSeconds: number;
};

/** Multi-select of the areas a production session went into, with the resulting time split. */
export function WorkedAreas({ selection, durationSeconds }: WorkedAreasProps) {
  const { t } = useTranslation();
  const workedAreas = reflectedAreas(selection.committedReflection);
  return (
    <View style={styles.branchSection}>
      <AreaChips
        prompt={t("sessionComplete.areasPrompt")}
        role="checkbox"
        isSelected={(branch) => workedAreas.includes(branch)}
        onPress={selection.toggleArea}
        testIDPrefix="worked-area"
      />
      {workedAreas.length > 0 ? (
        <AreaTimePreview selection={selection} durationSeconds={durationSeconds} />
      ) : (
        <Text style={styles.focusCardHint}>{t("sessionComplete.areasEmpty")}</Text>
      )}
    </View>
  );
}

function AreaTimePreview({ selection, durationSeconds }: WorkedAreasProps) {
  const { t } = useTranslation();
  const shares = areaTimeSplit(durationSeconds, selection.committedReflection);
  if (shares.length === 0) return null;
  const preview = shares
    .map(({ branch, seconds }) =>
      t("sessionComplete.areaTimeShare", {
        area: sessionTypeLabel(branch, t),
        time: formatCompactDuration(seconds),
      }),
    )
    .join(" · ");
  return (
    <Animated.Text
      key={preview}
      entering={FadeIn.duration(motion.quick)}
      style={styles.areaTimePreview}
      accessibilityLiveRegion="polite"
      testID="area-time-preview"
    >
      {preview}
    </Animated.Text>
  );
}

type AreaWeightControlProps = {
  branch: SkillBranch;
  selection: FocusReflectionSelection;
};

/** "A little / some / a lot" for one area; decides its share of the session time. */
export function AreaWeightControl({ branch, selection }: AreaWeightControlProps) {
  const { t } = useTranslation();
  const accent = sessionTypeAccent(branch);
  const current = weightOfArea(selection.committedReflection, branch);
  return (
    <View
      style={styles.weightControl}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("sessionComplete.areaWeightLabel", {
        area: sessionTypeLabel(branch, t),
      })}
    >
      {AREA_WEIGHTS.map((weight) => {
        const isSelected = weight === current;
        return (
          <Pressable
            key={weight}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            hitSlop={SEGMENT_HIT_SLOP}
            onPress={() => {
              if (isSelected) return;
              Haptics.selectionAsync().catch(() => undefined);
              selection.setAreaWeight(branch, weight);
            }}
            testID={`area-weight-${branch}-${weight}`}
            style={({ pressed }) => [
              styles.weightSegment,
              isSelected && { borderColor: accent, backgroundColor: `${accent}26` },
              pressed && styles.tilePressed,
            ]}
          >
            <Text style={[styles.weightSegmentText, isSelected && styles.weightSegmentTextActive]}>
              {t(WEIGHT_LABEL_KEYS[weight])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
