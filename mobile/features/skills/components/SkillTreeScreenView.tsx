import { ChevronLeft, List, Moon, Network } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { colors, motion, spacing } from "../../../constants/theme";
import { skillFocusText } from "../../../lib/skillI18n";
import { formatCompactDuration } from "../../sessions/skillProgressPresentation";
import type { SkillTreeScreenState } from "../hooks/useSkillTreeScreen";
import { styles } from "../skillTree.styles";
import { SkillNodeDetailCard } from "./SkillNodeDetailCard";
import { SkillTreeCanvas } from "./SkillTreeCanvas";
import { SkillTreeList } from "./SkillTreeList";

const HEADER_HEIGHT = 60;

type SkillTreeScreenViewProps = { screen: SkillTreeScreenState; onBack: () => void };

export function SkillTreeScreenView({ screen, onBack }: SkillTreeScreenViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!screen.isReady && screen.loadState === "error") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]} testID="skill-tree-screen">
        <Header screen={screen} onBack={onBack} />
        <View style={styles.centeredState}>
          <ErrorState
            title={t("common.oops")}
            message={t("skillTree.loadError")}
            retryLabel={t("skillTree.retry")}
            onRetry={screen.retry}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="skill-tree-screen">
      {screen.viewMode === "tree" ? (
        <SkillTreeCanvas screen={screen} />
      ) : (
        <SkillTreeList
          model={screen.model}
          topInset={insets.top + HEADER_HEIGHT + spacing.sm}
          bottomInset={insets.bottom + spacing.lg}
          onShowFocus={screen.showFocus}
        />
      )}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Header screen={screen} onBack={onBack} />
        {screen.viewMode === "tree" ? <TreeStatus screen={screen} /> : null}
      </View>
      {screen.viewMode === "tree" ? (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
          pointerEvents="box-none"
        >
          <TreeFooter screen={screen} />
        </View>
      ) : null}
    </View>
  );
}

function Header({ screen, onBack }: SkillTreeScreenViewProps) {
  const { t } = useTranslation();
  const { model } = screen;
  const isList = screen.viewMode === "list";
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("skillTree.back")}
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        testID="skill-tree-back"
      >
        <ChevronLeft size={22} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t("skillTree.title")}
        </Text>
        {screen.isReady ? (
          <Text style={styles.headerSummary}>
            {t("skillTree.summary", {
              unlocked: model.unlockedFocusCount,
              total: model.focusCount,
              time: formatCompactDuration(model.totalSeconds),
            })}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isList ? t("skillTree.showTree") : t("skillTree.showList")}
        onPress={screen.toggleViewMode}
        disabled={!screen.isReady}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        testID="skill-tree-toggle-view"
      >
        {isList ? (
          <Network size={20} color={colors.textPrimary} />
        ) : (
          <List size={20} color={colors.textPrimary} />
        )}
      </Pressable>
    </View>
  );
}

function TreeStatus({ screen }: { screen: SkillTreeScreenState }) {
  const { t } = useTranslation();
  if (!screen.isReady) {
    return (
      <View style={styles.loadingPill} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  }
  const { neglected } = screen;
  if (!neglected) return null;
  return (
    <Animated.View entering={FadeIn.duration(motion.standard).delay(600)}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t("skillTree.neglectedHint")}
        onPress={() => screen.showFocus(neglected.id)}
        style={({ pressed }) => [styles.neglectedChip, pressed && styles.pressed]}
        testID="skill-tree-neglected"
      >
        <Moon size={14} color={colors.textSecondary} />
        <Text style={styles.neglectedChipText}>
          {t("skillTree.neglected", {
            count: neglected.days,
            focus: skillFocusText(neglected.id, "short", t),
          })}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function TreeFooter({ screen }: { screen: SkillTreeScreenState }) {
  const { t } = useTranslation();
  if (screen.selectedId) {
    return (
      <SkillNodeDetailCard
        nodeId={screen.selectedId}
        model={screen.model}
        onClose={screen.clearSelection}
      />
    );
  }
  if (screen.isReady && screen.model.totalSeconds === 0) {
    return (
      <Animated.View
        entering={FadeInDown.duration(motion.standard).delay(500)}
        style={styles.card}
        testID="skill-tree-empty"
      >
        <Text style={styles.cardTitle}>{t("skillTree.emptyTitle")}</Text>
        <Text style={styles.cardBody}>{t("skillTree.emptyBody")}</Text>
      </Animated.View>
    );
  }
  return (
    <Animated.Text
      entering={FadeIn.duration(motion.standard).delay(900)}
      exiting={FadeOut.duration(motion.quick)}
      style={styles.gestureHint}
    >
      {t("skillTree.gestureHint")}
    </Animated.Text>
  );
}
