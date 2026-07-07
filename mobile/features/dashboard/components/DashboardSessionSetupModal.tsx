import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ViewStyle } from "react-native";

import { SessionSetupForm } from "../../../components/session/SessionSetupForm";
import { CrashBoundary } from "../../../components/ui/CrashBoundary";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

const SCREEN_HEIGHT = Dimensions.get("window").height;

type DashboardSessionSetupModalProps = {
  visible: boolean;
  formKey: number;
  sheetStyle: AnimatedStyle<ViewStyle>;
  closeSetupModal: (after?: () => void) => void;
  onCrashRecover: () => void;
  onActiveSessionConflict: () => void;
  onSessionStarted: (created: unknown) => void;
};

export function DashboardSessionSetupModal({
  visible,
  formKey,
  sheetStyle,
  closeSetupModal,
  onCrashRecover,
  onActiveSessionConflict,
  onSessionStarted,
}: DashboardSessionSetupModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => closeSetupModal()}
      statusBarTranslucent
    >
      {/* Modals are a separate native hierarchy on iOS — gestures need their own root here. */}
      <GestureHandlerRootView style={styles.modalGestureRoot}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => closeSetupModal()} />
          <Animated.View style={[styles.modalSheet, sheetStyle]}>
            <SafeAreaView style={styles.modalSafe} edges={["bottom"]} testID="session-setup-modal">
              <View>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>{t("dashboard.newSessionTitle")}</Text>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                      closeSetupModal();
                    }}
                    style={styles.modalCloseBtn}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </Pressable>
                </View>
                <CrashBoundary
                  scope="session_setup_modal"
                  fallbackTitle={t("crashBoundary.sessionSetupTitle")}
                  fallbackMessage={t("crashBoundary.sessionSetupMessage")}
                  onRecover={onCrashRecover}
                >
                  <SessionSetupForm
                    key={formKey}
                    hideTitleRow
                    onActiveSessionConflict={onActiveSessionConflict}
                    onStarted={onSessionStarted}
                  />
                </CrashBoundary>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalGestureRoot: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  modalSheet: {
    maxHeight: SCREEN_HEIGHT * 0.94,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modalSafe: {
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.94,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: { color: colors.textPrimary, fontSize: 18, fontFamily: fontFamily.bodyBold },
});
