import * as Haptics from "expo-haptics";
import { Check, ChevronDown } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { useScrollReveal } from "../../../components/ui/ScrollReveal";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { SESSION_TYPE_IDS, type SessionType } from "../../../types/session";

const OPTION_HEIGHT = 46;
const MENU_GAP = 6;
/** Keeps the menu clear of the home indicator. */
const SCREEN_MARGIN_BOTTOM = 40;

type Anchor = { x: number; y: number; width: number; height: number };

/**
 * The current session type as one field. Tapping it drops a menu down from the field over the
 * screen. When the full list would not fit below, the page scrolls up first to make room; if
 * the page cannot scroll that far, the menu scrolls instead.
 */
export function SessionTypeDropdown({
  value,
  onChange,
}: {
  value: SessionType;
  onChange: (type: SessionType) => void;
}) {
  const { t } = useTranslation();
  const fieldRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const reveal = useScrollReveal();
  const listHeight = SESSION_TYPE_IDS.length * OPTION_HEIGHT;

  const measure = () =>
    new Promise<Anchor | null>((resolve) => {
      if (!fieldRef.current) resolve(null);
      else
        fieldRef.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    });

  const open = async () => {
    Haptics.selectionAsync().catch(() => undefined);
    let field = await measure();
    if (!field) return;
    const shortfall =
      field.y + field.height + MENU_GAP + listHeight - (screenHeight - SCREEN_MARGIN_BOTTOM);
    if (shortfall > 0 && reveal) {
      await reveal(shortfall);
      field = (await measure()) ?? field;
    }
    setAnchor(field);
  };
  const close = () => setAnchor(null);
  const choose = (type: SessionType) => {
    if (type !== value) Haptics.selectionAsync().catch(() => undefined);
    onChange(type);
    close();
  };

  const menuTop = anchor ? anchor.y + anchor.height + MENU_GAP : 0;
  const menuMaxHeight = Math.min(listHeight, screenHeight - menuTop - SCREEN_MARGIN_BOTTOM);

  return (
    <>
      <Pressable
        ref={fieldRef}
        accessibilityRole="button"
        accessibilityLabel={t("sessionDetail.sessionTypeDropdownA11y", {
          type: sessionTypeLabel(value, t),
        })}
        accessibilityState={{ expanded: anchor != null }}
        onPress={() => void open()}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {sessionTypeLabel(value, t)}
        </Text>
        <ChevronDown color={colors.textSecondary} size={18} />
      </Pressable>

      <Modal
        visible={anchor != null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Animated.View entering={FadeIn.duration(120)} style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          />
        </Animated.View>
        {anchor ? (
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={[
              styles.menu,
              {
                left: anchor.x,
                width: anchor.width,
                top: menuTop,
                maxHeight: menuMaxHeight,
              },
            ]}
            accessibilityRole="menu"
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {SESSION_TYPE_IDS.map((type, index) => {
                const selected = type === value;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => choose(type)}
                    style={({ pressed }) => [
                      styles.option,
                      index > 0 && styles.optionDivider,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {sessionTypeLabel(type, t)}
                    </Text>
                    {selected ? <Check color={colors.primary} size={16} strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.85 },
  fieldText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menu: {
    position: "absolute",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: OPTION_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  optionText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  optionTextSelected: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
  },
});
