import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
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
  const body = <ActiveSessionBody controller={controller} />;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {controller.fromDashboard ? (
        <Animated.View style={[styles.flex, controller.dismissDragStyle]}>{body}</Animated.View>
      ) : (
        body
      )}
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
      {controller.fromDashboard ? (
        <GestureDetector gesture={controller.swipeDownGesture}>
          <View style={styles.minimizeStrip}>
            <View style={styles.grabber} />
            <Text style={styles.minimizeHint}>{t("sessionActive.minimizeHint")}</Text>
          </View>
        </GestureDetector>
      ) : null}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sessionTypeLabel(session.session_type, t)}</Text>
        </View>
        <Text style={styles.warn}>{t("sessionActive.inProgress")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.timerWrap, controller.pulseStyle]}>
          <Text style={styles.timer}>{formatSessionClock(controller.elapsed)}</Text>
          <Text style={styles.subTimer}>{formatDurationWords(controller.elapsed)}</Text>
        </Animated.View>
        <View style={styles.insightCard}>
          <Text style={styles.insightText}>{controller.insightLine}</Text>
        </View>
        <ActiveSessionEditor controller={controller} />
        {controller.error ? <Text style={styles.err}>{controller.error}</Text> : null}
        <View style={styles.actions}>
          {controller.isPaused ? (
            <PrimaryButton
              label={t("sessionActive.resume")}
              onPress={controller.resume}
              loading={controller.busy}
            />
          ) : (
            <Pressable
              style={styles.pauseOutline}
              onPress={controller.pause}
              disabled={controller.busy}
            >
              <Text style={styles.pauseText}>{t("sessionActive.pause")}</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.stopBtn}
          onPress={controller.confirmStop}
          disabled={controller.busy}
        >
          <Text style={styles.stopTxt}>{t("sessionActive.stopSession")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
