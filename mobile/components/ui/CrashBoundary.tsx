import { Component, type ReactNode } from "react";
import { getI18n } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { debugLog } from "../../lib/debugLog";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  scope: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRecover?: () => void;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class CrashBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    debugLog("crash_boundary", "render_error", { scope: this.props.scope, message: error.message });
  }

  private onRecover = () => {
    this.setState({ hasError: false });
    this.props.onRecover?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const t = getI18n().t;
    const title = this.props.fallbackTitle ?? t("crashBoundary.genericTitle");
    const message = this.props.fallbackMessage ?? t("crashBoundary.genericMessage");

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={styles.btn}
          onPress={this.onRecover}
          accessibilityRole="button"
          accessibilityLabel={t("crashBoundary.retry")}
        >
          <Text style={styles.btnTxt}>{t("crashBoundary.retry")}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    margin: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  btn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnTxt: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
});
