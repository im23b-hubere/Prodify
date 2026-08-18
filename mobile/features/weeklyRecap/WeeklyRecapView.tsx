import { View } from "react-native";
import ViewShot from "react-native-view-shot";

import type { WeeklyRecapController } from "./useWeeklyRecapController";
import { WeeklyRecapError, WeeklyRecapLoading, WeeklyRecapSignIn } from "./WeeklyRecapStates";
import { weeklyRecapStyles as styles } from "./weeklyRecap.styles";
import { WeeklyWrappedShareCard } from "./WeeklyWrappedShareCard";
import { WeeklyWrappedViewer } from "./WeeklyWrappedViewer";

export function WeeklyRecapView({ controller }: { controller: WeeklyRecapController }) {
  if (controller.loading) return <WeeklyRecapLoading />;
  if (!controller.token) return <WeeklyRecapSignIn controller={controller} />;
  if (controller.error && !controller.hasCardData)
    return <WeeklyRecapError controller={controller} />;
  const { t, summary } = controller;
  return (
    <View style={styles.fullscreen}>
      <WeeklyWrappedViewer
        slides={controller.slides}
        t={t}
        onClose={controller.close}
        showGenerate={Boolean(controller.token && !controller.review)}
        generateBusy={controller.generateBusy}
        generateError={controller.generateError}
        onGenerate={() => void controller.generateRecap()}
        showShare={Boolean(controller.token && controller.hasCardData)}
        shareBusy={controller.shareBusy}
        shareTemplate={controller.shareTemplate}
        onShareTemplateChange={controller.setShareTemplate}
        onShareCard={() => void controller.shareCard()}
        onShareText={controller.shareText}
        onSetGoals={controller.setGoals}
        onStartSession={controller.startSession}
        statsWarning={controller.statsWarning}
      />
      <View style={styles.hiddenShot} pointerEvents="none">
        <ViewShot
          ref={(node) => {
            controller.shotRef.current = node;
          }}
          options={{ format: "png", quality: 1 }}
          style={styles.shotInner}
        >
          <WeeklyWrappedShareCard
            t={t}
            template={controller.shareTemplate}
            displaySessions={controller.displaySessions}
            displayHours={controller.displayHours}
            currentStreak={summary?.current_streak_days ?? 0}
            bestStreak={summary?.best_streak_days ?? 0}
            weekRange={controller.weekRange}
            topTypeLabel={controller.topTypeLabel}
          />
        </ViewShot>
      </View>
    </View>
  );
}
