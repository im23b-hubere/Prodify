import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { HoldToStopButton, PauseButton } from "../../../components/session/SessionTransport";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords } from "../../../lib/sessionTime";
import { formatSessionClock } from "../activeSessionPresentation";
import type { ActiveSessionController } from "../hooks/useActiveSessionController";
import { sessionActiveStyles as styles } from "../sessionActive.styles";
import { ActiveSessionBoot } from "./ActiveSessionBoot";
import { ActiveSessionEditor } from "./ActiveSessionEditor";

export function ActiveSessionView({ controller }: { controller: ActiveSessionController }) {
  useKeepAwake();
  if (!controller.session) return <ActiveSessionBoot controller={controller} />;
  // Presented as a sheet: the top inset belongs to the screen peeking out behind it.
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ActiveSessionBody controller={controller} />
    </SafeAreaView>
  );
}

function ActiveSessionBody({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const session = controller.session;
  if (!session) return null;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={styles.liveRow}>
        {controller.isPaused ? null : (
          <Animated.View style={[styles.liveDot, controller.pulseStyle]} />
        )}
        <Text style={controller.isPaused ? styles.pausedLabel : styles.liveLabel}>
          {controller.isPaused ? t("dashboard.pausedLabel") : t("dashboard.liveLabel")}
        </Text>
        <Text style={styles.liveSep}>·</Text>
        <Text style={styles.typeLabel}>{sessionTypeLabel(session.session_type, t)}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timerWrap}>
          <Text style={[styles.timer, controller.isPaused && styles.timerPaused]}>
            {formatSessionClock(controller.elapsed)}
          </Text>
          <Text style={styles.subTimer}>{formatDurationWords(controller.elapsed, t)}</Text>
          <Text style={styles.insight}>{controller.insightLine}</Text>
        </View>
        <ActiveSessionEditor controller={controller} />
        {controller.error ? <Text style={styles.err}>{controller.error}</Text> : null}
      </ScrollView>
      <ActionBar controller={controller} />
    </KeyboardAvoidingView>
  );
}

/** The same round transport keys as the dashboard deck: pause, and hold to stop. */
function ActionBar({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const paused = controller.isPaused;
  return (
    <View style={styles.actionBar}>
      <PauseButton
        paused={paused}
        disabled={controller.busy}
        label={paused ? t("sessionActive.resume") : t("sessionActive.pause")}
        onPress={() => void (paused ? controller.resume() : controller.pause())}
      />
      <HoldToStopButton
        disabled={controller.busy}
        label={t("sessionActive.holdToEnd")}
        accessibilityHint={t("sessionActive.holdToEndA11y")}
        onHoldComplete={controller.stopNow}
      />
    </View>
  );
}
