import { Component, type ReactNode } from "react";
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

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{this.props.fallbackTitle ?? "Something went wrong"}</Text>
        <Text style={styles.message}>
          {this.props.fallbackMessage ?? "Please try again. If this continues, restart the app."}
        </Text>
        <Pressable style={styles.btn} onPress={this.onRecover}>
          <Text style={styles.btnTxt}>Retry</Text>
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
