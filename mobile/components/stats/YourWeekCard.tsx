import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { useYourWeekCardModel } from "../../features/stats/useYourWeekCardModel";
import { useYourWeekGoalEditor } from "../../features/stats/useYourWeekGoalEditor";
import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
import type { GoalForecastDto } from "../../types/outcomes";
import { AppCard } from "../ui/AppCard";
import { YourWeekGoalEditorModal } from "./YourWeekGoalEditorModal";
import { YourWeekProgress, YourWeekSetup } from "./YourWeekCardSections";
import { yourWeekStyles as styles } from "./yourWeek.styles";

export type YourWeekCardProps = {
  t: TFunction;
  goal: GoalCurrentDto | null;
  forecast: GoalForecastDto | null;
  commitment: CommitmentDto | null;
  heatmapDays: { date: string; seconds: number; intensity: number }[];
  configured: boolean;
  busy: boolean;
  hero?: boolean;
  embedded?: boolean;
  onSaveGoal: (target: number, shareWithFriends: boolean) => Promise<void>;
  onStartSession: () => void;
};

export function YourWeekCard(props: YourWeekCardProps) {
  const editor = useYourWeekGoalEditor(props);
  const model = useYourWeekCardModel(props, editor);
  const body = (
    <>
      <Text
        style={[
          styles.sectionEyebrow,
          props.hero && props.embedded ? styles.sectionEyebrowEmbedded : null,
        ]}
      >
        {props.t("stats.yourWeek.eyebrow")}
      </Text>
      {!props.configured ? (
        <YourWeekSetup props={props} editor={editor} model={model} />
      ) : (
        <YourWeekProgress props={props} editor={editor} model={model} />
      )}
    </>
  );
  return (
    <>
      <View testID={props.hero ? "your-week-hero" : undefined}>
        {props.hero && props.embedded ? (
          <View style={styles.embeddedShell}>{body}</View>
        ) : (
          <AppCard style={[styles.card, props.hero ? styles.cardHero : undefined]}>{body}</AppCard>
        )}
      </View>
      <YourWeekGoalEditorModal
        t={props.t}
        visible={editor.open}
        busy={props.busy}
        selectedTarget={editor.selectedTarget}
        customTarget={editor.customTarget}
        shareWithFriends={editor.shareWithFriends}
        onClose={editor.close}
        onSelectPreset={editor.selectPreset}
        onChangeCustomTarget={editor.setCustomTarget}
        onChangeSharing={editor.setShareWithFriends}
        onSave={editor.save}
      />
    </>
  );
}
