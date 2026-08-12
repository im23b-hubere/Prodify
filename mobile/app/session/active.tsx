import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { isMoodLevel, MoodIcon, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import { sessionActiveStyles as styles } from "../../features/sessions/sessionActive.styles";
import {
  ACTIVE_NOTES_MAX_LENGTH,
  useActiveSession,
} from "../../features/sessions/hooks/useActiveSession";
import { formatSessionClock } from "../../features/sessions/activeSessionPresentation";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import { SESSION_TYPE_IDS } from "../../types/session";

export default function SessionActiveScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; source?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const rawSource = params.source;
  const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
  const {
    session,
    loading,
    error,
    busy,
    elapsed,
    isPaused,
    draftNotes,
    setDraftNotes,
    savingNotes,
    tagList,
    insightLine,
    load,
    pause,
    resume,
    saveNotes,
    setSessionType,
    confirmStop,
  } = useActiveSession(id);
  const pulse = useSharedValue(1);
  const dismissDragY = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const dismissDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissDragY.value }],
  }));

  useEffect(() => {
    if (isPaused) {
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
    );
  }, [isPaused, pulse]);

  const fromDashboard = source === "dashboard";

  const minimizeToDashboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard");
  }, [router]);

  const finishDismissDrag = useCallback(
    (translationY: number, velocityY: number) => {
      const shouldDismiss = translationY > 48 || velocityY > 650;
      if (shouldDismiss) {
        minimizeToDashboard();
        return;
      }
      dismissDragY.value = withTiming(0, { duration: 220 });
    },
    [dismissDragY, minimizeToDashboard],
  );

  const swipeDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(fromDashboard)
        .activeOffsetY(12)
        .failOffsetX([-28, 28])
        .onUpdate((e) => {
          dismissDragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          runOnJS(finishDismissDrag)(e.translationY, e.velocityY);
        }),
    [dismissDragY, finishDismissDrag, fromDashboard],
  );

  if (!session) {
    const loadingMessage =
      id != null && id !== ""
        ? t("sessionActive.resumingSession")
        : t("sessionActive.loadingSession");

    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.bootWrap}>
          {loading && !error ? (
            <LoadingState message={loadingMessage} />
          ) : (
            <>
              <ErrorState
                title={t("common.oops")}
                message={error ?? t("sessionActive.loadFailed")}
                retryLabel={t("common.tryAgain")}
                onRetry={() => void load()}
              />
              <Pressable
                onPress={() => router.replace("/(tabs)/dashboard")}
                style={styles.bootBackBtn}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
              >
                <Text style={styles.bootBackTxt}>{t("common.back")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const screenBody = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={8}
    >
      {fromDashboard ? (
        <GestureDetector gesture={swipeDownGesture}>
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
        <Animated.View style={[styles.timerWrap, pulseStyle]}>
          <Text style={styles.timer}>{formatSessionClock(elapsed)}</Text>
          <Text style={styles.subTimer}>{formatDurationWords(elapsed)}</Text>
        </Animated.View>

        <View style={styles.insightCard}>
          <Text style={styles.insightText}>{insightLine}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.editLabel}>{t("sessionActive.sessionType")}</Text>
          <View style={styles.typeRow}>
            {SESSION_TYPE_IDS.map((stype) => {
              const active = session.session_type === stype;
              return (
                <Pressable
                  key={stype}
                  onPress={() => setSessionType(stype)}
                  disabled={busy}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipTxt, active && styles.typeChipTxtActive]}>
                    {sessionTypeLabel(stype, t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {session.mood_level && isMoodLevel(session.mood_level) ? (
            <View style={[glyphRowStyle, styles.moodRow]}>
              <Text style={styles.row}>{t("sessionActive.mood")}</Text>
              <MoodIcon level={session.mood_level} size={20} />
            </View>
          ) : null}

          <Text style={styles.editLabel}>{t("sessionActive.notes")}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={t("sessionActive.notesPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            maxLength={ACTIVE_NOTES_MAX_LENGTH}
            value={draftNotes}
            onChangeText={setDraftNotes}
            onBlur={() => saveNotes().catch(() => undefined)}
          />
          <View style={styles.notesFooter}>
            <Text style={styles.counter}>
              {draftNotes.length}/{ACTIVE_NOTES_MAX_LENGTH}
            </Text>
            <Pressable
              onPress={() => saveNotes().catch(() => undefined)}
              disabled={savingNotes}
              hitSlop={8}
            >
              <Text style={styles.saveNotes}>
                {savingNotes ? t("sessionActive.saving") : t("sessionActive.save")}
              </Text>
            </Pressable>
          </View>

          {tagList.length > 0 ? (
            <View style={styles.tags}>
              {tagList.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <View style={styles.actions}>
          {isPaused ? (
            <PrimaryButton label={t("sessionActive.resume")} onPress={resume} loading={busy} />
          ) : (
            <Pressable style={styles.pauseOutline} onPress={pause} disabled={busy}>
              <Text style={styles.pauseText}>{t("sessionActive.pause")}</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.stopBtn} onPress={confirmStop} disabled={busy}>
          <Text style={styles.stopTxt}>{t("sessionActive.stopSession")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {fromDashboard ? (
        <Animated.View style={[styles.flex, dismissDragStyle]}>{screenBody}</Animated.View>
      ) : (
        screenBody
      )}
    </SafeAreaView>
  );
}
